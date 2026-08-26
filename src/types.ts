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
  username: string
  website: string
  tagline: string
  amount: number
}

export interface BidResult {
  ok: true
  rank: number
  username: string
  website: string
  amount: number
  demoted: Character | null
  previousRank: number | null
}

export interface BidError {
  ok: false
  error: string
}
