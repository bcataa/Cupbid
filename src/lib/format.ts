export function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

export function displayUsername(username: string) {
  return `@${normalizeUsername(username)}`
}

export function normalizeWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function displayHost(website: string) {
  try {
    return new URL(normalizeWebsite(website)).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
}

export function websiteKey(value: string) {
  try {
    const url = new URL(normalizeWebsite(value))
    return url.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export function isValidWebsite(value: string) {
  try {
    const url = new URL(normalizeWebsite(value))
    return Boolean(url.hostname.includes('.'))
  } catch {
    return false
  }
}

/** Public favicon proxy — works for most real domains without CORS issues. */
export function logoUrlForWebsite(website: string, size = 64) {
  const host = websiteKey(website)
  if (!host) return ''
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`
}

export function sortByAmount<T extends { amount: number }>(characters: T[]): T[] {
  return [...characters].sort((a, b) => b.amount - a.amount)
}
