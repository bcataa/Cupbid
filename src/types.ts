export interface Character {
  id: string
  username: string
  website: string
  tagline: string
  amount: number
}

export interface BidActivity {
  id: string
  username: string
  website: string
  amount: number
  paid: number
  rank: number
  previousRank: number | null
  tookCup: boolean
  createdAt: number
}

export interface BidInput {
  website: string
  tagline: string
  amount: number
}

export interface BidResult {
  ok: true
  checkoutUrl?: string
  projectedRank?: number
  free?: boolean
}

export interface BidError {
  ok: false
  error: string
}
