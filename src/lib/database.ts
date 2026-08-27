import { sortByAmount } from './format'
import { isSupabaseConfigured, supabase } from './supabase'
import type { BidActivity, Character } from '../types'

export interface DbListing {
  id: string
  user_id: string
  website: string
  website_key: string
  tagline: string
  amount: number
  created_at: string
  updated_at: string
  profiles: { username: string } | { username: string }[] | null
}

export interface DbBid {
  id: string
  user_id: string
  listing_id: string
  website: string
  tagline: string
  amount: number
  paid: number
  position: number
  created_at: string
  profiles: { username: string } | { username: string }[] | null
}

function profileUsername(
  profiles: { username: string } | { username: string }[] | null,
): string {
  if (!profiles) return 'user'
  if (Array.isArray(profiles)) return profiles[0]?.username ?? 'user'
  return profiles.username
}

export function listingToCharacter(row: DbListing): Character {
  return {
    id: row.id,
    username: profileUsername(row.profiles),
    website: row.website,
    tagline: row.tagline,
    amount: row.amount,
  }
}

export function bidToActivity(row: DbBid): BidActivity {
  return {
    id: row.id,
    username: profileUsername(row.profiles),
    website: row.website,
    amount: row.amount,
    paid: row.paid,
    rank: row.position,
    previousRank: null,
    tookCup: row.position === 1,
    createdAt: new Date(row.created_at).getTime(),
  }
}

export async function fetchLeaderboard(): Promise<Character[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('listings')
    .select('id, user_id, website, website_key, tagline, amount, created_at, updated_at, profiles(username)')
    .order('amount', { ascending: false })
    .order('updated_at', { ascending: true })

  if (error) throw error
  return sortByAmount((data ?? []).map(listingToCharacter))
}

export async function fetchBids(): Promise<BidActivity[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('bids')
    .select('id, user_id, listing_id, website, tagline, amount, paid, position, created_at, profiles(username)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(bidToActivity)
}

export async function fetchPageViews(): Promise<number> {
  if (!isSupabaseConfigured) return 0

  const { data, error } = await supabase
    .from('site_metrics')
    .select('page_views')
    .eq('id', 'global')
    .maybeSingle()

  if (error) throw error
  return data?.page_views ?? 0
}

export async function incrementPageViews(): Promise<number> {
  if (!isSupabaseConfigured) return 0

  const { data, error } = await supabase.rpc('increment_page_views')
  if (error) throw error
  return data ?? 0
}

export function subscribeToLeaderboard(onChange: () => void) {
  if (!isSupabaseConfigured) return () => {}

  const channel = supabase
    .channel('leaderboard-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'listings' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'bids' },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export interface CheckoutResponse {
  checkoutUrl?: string
  projectedRank?: number
  pendingCheckoutId?: string
  free?: boolean
  error?: string
}

/** Temporary free bids for testing (SQL place_free_bid). No Stripe needed. */
export async function placeFreeBid(input: {
  website: string
  websiteKey: string
  tagline: string
  amount: number
}): Promise<CheckoutResponse> {
  if (!isSupabaseConfigured) {
    return { error: 'Database is not configured. Add Supabase env variables.' }
  }

  const { data, error } = await supabase.rpc('place_free_bid', {
    p_website: input.website,
    p_website_key: input.websiteKey,
    p_tagline: input.tagline,
    p_amount: input.amount,
  })

  if (error) {
    return { error: error.message || 'Could not place bid.' }
  }

  const result = data as { position?: number; amount?: number } | null
  return {
    free: true,
    projectedRank: result?.position,
  }
}

export async function createBidCheckout(input: {
  website: string
  tagline: string
  amount: number
}): Promise<CheckoutResponse> {
  if (!isSupabaseConfigured) {
    return { error: 'Database is not configured. Add Supabase env variables.' }
  }

  const { data, error } = await supabase.functions.invoke('create-bid-checkout', {
    body: input,
  })

  if (error) {
    return { error: error.message || 'Could not start checkout.' }
  }

  const payload = data as CheckoutResponse
  if (payload.error) {
    return { error: payload.error }
  }

  return payload
}
