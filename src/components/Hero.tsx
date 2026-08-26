import { useMemo, useState, type FormEvent } from 'react'
import { MIN_SPONSOR_BID } from '../data/mockCharacters'
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
  onSeeStats: () => void
  onSubmit: (input: BidInput) => BidResult | BidError
}

export function Hero({
  top,
  characters,
  online,
  visitors,
  onSeeStats,
  onSubmit,
}: HeroProps) {
  const minToLead = top ? top.amount + 1 : MIN_SPONSOR_BID

  const [manualAmount, setManualAmount] = useState<number | null>(null)
  const [amountText, setAmountText] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const [tagline, setTagline] = useState('')
  const [error, setError] = useState('')

  const normalizedSite = website.trim() ? normalizeWebsite(website) : ''
  const validSite = Boolean(normalizedSite && isValidWebsite(normalizedSite))
  const host = validSite ? displayHost(normalizedSite) : ''

  const existing = useMemo(() => {
    if (!validSite) return null
    const key = websiteKey(normalizedSite)
    return characters.find((c) => websiteKey(c.website) === key) ?? null
  }, [characters, normalizedSite, validSite])

  const isRaise = Boolean(existing)
  const minAllowed = existing ? existing.amount + 1 : MIN_SPONSOR_BID
  const suggestedBid = Math.max(minAllowed, minToLead)
  const amount = Math.max(minAllowed, manualAmount ?? suggestedBid)
  const amountDisplay = amountText ?? String(amount)
  const existingRank = existing
    ? characters.findIndex((c) => c.id === existing.id) + 1
    : null

  const projectedRank = useMemo(() => {
    const others = characters.filter((c) => !existing || c.id !== existing.id)
    return others.filter((c) => c.amount >= amount).length + 1
  }, [characters, existing, amount])

  const beatsTop = Boolean(
    top && amount > top.amount && (!existing || existing.id !== top.id),
  )

  const setBidAmount = (value: number) => {
    const next = Math.max(minAllowed, Math.floor(value) || minAllowed)
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
    setBidAmount(amount || minAllowed)
  }

  const handleWebsiteChange = (value: string) => {
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
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const site = normalizeWebsite(website)
    const handle = isValidWebsite(site)
      ? (displayHost(site).split('.')[0] ?? '')
      : ''
    const finalAmount = Math.max(minAllowed, amount || minAllowed)
    const result = onSubmit({
      username: handle,
      website: site,
      tagline: tagline || `Sponsored ${displayHost(site)}`,
      amount: finalAmount,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setWebsite('')
    setTagline('')
    setManualAmount(null)
    setAmountText(null)
  }

  return (
    <header className="hero">
      <LiveStatsPill online={online} visitors={visitors} onSeeStats={onSeeStats} />

      <h1 className="claim-title">
        {isRaise ? 'Raise your bid' : 'Pay for the cup'}
      </h1>

      <p className="hero-pitch">
        Ads are too expensive. Bid here instead — put your site on the board and
        people will click through.
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
            aria-label="Type your bid amount"
          />
        </label>
        <button type="button" aria-label="Increase bid" onClick={() => bump(1)}>
          +
        </button>
      </div>

      <p className="hero-copy">
        {formatMoney(suggestedBid)} takes #1 right now
        {top ? ` · ${displayHost(top.website)} is at ${formatMoney(top.amount)}` : ''}.
        {isRaise && existing
          ? ` You’re raising ${displayHost(existing.website)} (#${existingRank}).`
          : ' Paste your site below — logo loads live.'}
      </p>

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
        <input
          className="pitch"
          type="text"
          placeholder="One-line pitch"
          maxLength={60}
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          aria-label="Pitch"
        />
        <button type="submit" className="btn primary">
          {beatsTop || amount >= minToLead
            ? `Pay ${formatMoney(amount)}`
            : isRaise
              ? `Raise to ${formatMoney(amount)}`
              : `Pay ${formatMoney(amount)}`}
        </button>
      </form>

      {validSite ? (
        <div className="site-preview" aria-live="polite">
          <SiteLogo website={normalizedSite} name={host} size="lg" />
          <div>
            <strong>{host}</strong>
            <p>
              {isRaise && existing
                ? `Current #${existingRank} · ${formatMoney(existing.amount)} → ${formatMoney(amount)}`
                : `You’ll land around #${projectedRank} for ${formatMoney(amount)}`}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : (
        <p className="fineprint">
          One payment. Your site stays on the board. Same URL raises your rank.
        </p>
      )}
    </header>
  )
}
