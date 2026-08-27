import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const PRESENCE_CHANNEL = 'cupbid-live'

function getSessionId() {
  const key = 'cupbid_presence_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

export function useOnlineCount() {
  const [online, setOnline] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const sessionId = getSessionId()
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: sessionId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnline(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return online
}
