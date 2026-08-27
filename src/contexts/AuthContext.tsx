import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  email: string
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null)
      return
    }
    const nextProfile = await fetchProfile(nextUser.id)
    setProfile(nextProfile)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      void loadProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      void loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signUp = useCallback(
    async (email: string, password: string, username: string): Promise<string | null> => {
      if (!isSupabaseConfigured) return 'Supabase is not configured.'
      const cleanUsername = username.trim().toLowerCase()
      if (!/^[a-z0-9_]{2,32}$/.test(cleanUsername)) {
        return 'Username must be 2–32 characters: letters, numbers, underscore.'
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: cleanUsername } },
      })

      return error?.message ?? null
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!isSupabaseConfigured) return 'Supabase is not configured.'
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({ user, profile, loading, signUp, signIn, signOut }),
    [user, profile, loading, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
