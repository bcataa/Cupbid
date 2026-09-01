import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DEFAULT_BID, MIN_SPONSOR_BID } from '../lib/constants'
import {
  displayHost,
  formatMoney,
  isValidWebsite,
  normalizeWebsite,
  websiteKey,
} from '../lib/format'
import type { BidError, BidInput, BidResult, Character } from '../types'
import { LiveStatsPill } from './LiveStatsPill'
import { SiteLogo } from './SiteLogo'

interface HeroProps {
  top: Character | null
  characters: Character[]
  online: number
  visitors: number
  prefillWebsite?: string | null
  onSeeStats: () => void
  onSubmit: (input: BidInput) => Promise<BidResult | BidError>
  onBidSuccess?: (result: { website: string; rank: number; listingId?: string }) => void
  onPrefillApplied?: () => void
}

export function Hero({
  top,
  characters,
  online,
  visitors,
  prefillWebsite,
  onSeeStats,
  onSubmit,
  onBidSuccess,
  onPrefillApplied,
}: HeroProps) {
  const minToLead = top ? top.amount + 1 : MIN_SPONSOR_BID

  const [manualAmount, setManualAmount] = useState<number | null>(null)
  const [amountText, setAmountText] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const [tagline, setTagline] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const normalizedSite = website.trim() ? normalizeWebsite(website) : ''
  const validSite = Boolean(normalizedSite && isValidWebsite(normalizedSite))
  const host = validSite ? displayHost(normalizedSite) : ''

  const existing = useMemo(() => {
    if (!validSite) return null
    const key = websiteKey(normalizedSite)
    return characters.find((c) => websiteKey(c.website) === key) ?? null
  }, [characters, normalizedSite, validSite])

  const isRaise = Boolean(existing)
  const minAllowed = isRaise ? existing!.amount + 1 : MIN_SPONSOR_BID
  const defaultAmount = isRaise ? existing!.amount + 1 : DEFAULT_BID
  const amount = Math.max(
    minAllowed,
    Math.max(MIN_SPONSOR_BID, manualAmount ?? defaultAmount),
  )
  const amountDisplay = amountText ?? String(amount)
  const payNow = isRaise ? amount - existing!.amount : amount
  const existingRank = existing
    ? characters.findIndex((c) => c.id === existing.id) + 1
    : null
  const lockedTagline = isRaise ? existing!.tagline : tagline

  const projectedRank = useMemo(() => {
    const others = characters.filter((c) => !existing || c.id !== existing.id)
    return others.filter((c) => c.amount >= amount).length + 1
  }, [characters, existing, amount])

  const beatsTop = Boolean(
    top && amount >= minToLead && (!existing || existing.id !== top.id),
  )

  useEffect(() => {
    if (!prefillWebsite) return
    applyWebsite(prefillWebsite)
    onPrefillApplied?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [prefillWebsite])

  const applyWebsite = (value: string) => {
    setWebsite(value)
    setError('')
    setManualAmount(null)
    setAmountText(null)
    const site = value.trim() ? normalizeWebsite(value) : ''
    if (!site || !isValidWebsite(site)) return
    const key = websiteKey(site)
    const match = characters.find((c) => websiteKey(c.website) === key)
    if (match) {
      setTagline(match.tagline)
    } else {
      setTagline('')
    }
  }

  const handleWebsiteChange = (value: string) => {
    applyWebsite(value)
  }

  const setBidAmount = (value: number) => {
    const next = Math.max(MIN_SPONSOR_BID, Math.floor(value) || MIN_SPONSOR_BID)
    setManualAmount(next)
    setAmountText(null)
  }

  const bump = (delta: number) => {
    setBidAmount(amount + delta)
  }

  const handleAmountType = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '')
    setAmountText(cleaned)
    if (!cleaned) return
    const parsed = Number(cleaned)
    if (!Number.isFinite(parsed)) return
    setManualAmount(Math.max(0, parsed))
  }

  const handleAmountBlur = () => {
    const next = Math.max(minAllowed, Math.max(MIN_SPONSOR_BID, amount || defaultAmount))
    setManualAmount(next)
    setAmountText(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    setBusy(true)
    setError('')

    const site = normalizeWebsite(website)
    const finalAmount = Math.max(minAllowed, Math.max(MIN_SPONSOR_BID, amount || defaultAmount))
    const finalTagline = isRaise
      ? existing!.tagline
      : tagline.trim() || `Sponsored ${displayHost(site)}`

    try {
      const result = await onSubmit({
        website: site,
        tagline: finalTagline,
        amount: finalAmount,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      if (result.checkoutUrl) return

      onBidSuccess?.({
        website: site,
        rank: result.projectedRank ?? projectedRank,
        listingId: existing?.id,
      })

      setWebsite('')
      setTagline('')
      setManualAmount(null)
      setAmountText(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="hero">
      <LiveStatsPill online={online} visitors={visitors} onSeeStats={onSeeStats} />

      <h1 className="claim-title">
        {isRaise ? 'Raise your bid' : 'Pay for the cup'}
      </h1>

      <p className="hero-pitch">
        Skip overpriced ads. Put your site on the board and get real clicks from
        people browsing right now.
      </p>

      <div className="amount-stepper amount-editor" aria-label="Bid amount">
        <button
          type="button"
          aria-label="Decrease bid"
          onClick={() => bump(-1)}
          disabled={amount <= minAllowed}
        >
          −
        </button>
        <label className="amount-input-wrap">
          <span>$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountDisplay}
            onChange={(event) => handleAmountType(event.target.value)}
            onBlur={handleAmountBlur}
            aria-label={isRaise ? 'Total bid on the board' : 'Bid amount'}
          />
        </label>
        <button type="button" aria-label="Increase bid" onClick={() => bump(1)}>
          +
        </button>
      </div>

      <form className="bid-bar" onSubmit={handleSubmit}>
        <div className="bid-site">
          <div className="bid-logo-slot" aria-hidden="true">
            {validSite ? (
              <SiteLogo website={normalizedSite} name={host || 'site'} size="md" />
            ) : (
              <span className="site-logo is-md is-empty">URL</span>
            )}
          </div>
          <input
            type="text"
            placeholder="yourwebsite.com"
            value={website}
            onChange={(event) => handleWebsiteChange(event.target.value)}
            required
            aria-label="Website URL"
          />
        </div>
        {isRaise ? (
          <div className="pitch pitch-locked" aria-label="Pitch (locked)">
            <span className="pitch-locked-label">Pitch locked</span>
            <span className="pitch-locked-text">{lockedTagline}</span>
          </div>
        ) : (
          <input
            className="pitch"
            type="text"
            placeholder="One-line pitch"
            maxLength={120}
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            aria-label="Pitch"
            required
          />
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy
            ? 'Processing…'
            : isRaise
              ? `Pay ${formatMoney(payNow)} now`
              : `Pay ${formatMoney(payNow)}`}
        </button>
      </form>

      {isRaise ? (
        <p className="pitch-note">Pitch can only be changed by admin. Raises update your rank only.</p>
      ) : null}

      {validSite ? (
        <div className="site-preview" aria-live="polite">
          <SiteLogo website={normalizedSite} name={host} size="lg" />
          <div>
            <strong>{host}</strong>
            <p>
              {isRaise && existing
                ? `#${existingRank} · ${formatMoney(existing.amount)} → ${formatMoney(amount)}`
                : beatsTop
                  ? `Takes #1 · ${formatMoney(amount)}`
                  : `Projected #${projectedRank} · ${formatMoney(amount)}`}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  )
}
