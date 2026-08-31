const CHECKOUT_KEY = 'cupbid_checkout'

export interface PendingCheckout {
  website: string
  amount: number
  projectedRank?: number
}

export function savePendingCheckout(pending: PendingCheckout) {
  sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(pending))
}

export function readPendingCheckout(): PendingCheckout | null {
  const raw = sessionStorage.getItem(CHECKOUT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingCheckout
  } catch {
    return null
  }
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(CHECKOUT_KEY)
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
