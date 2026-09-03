import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrandLogo } from './components/BrandLogo'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Leaderboard } from './components/Leaderboard'
import { PageBackground } from './components/PageBackground'
import { ShareCard } from './components/ShareCard'
import { ShareSite } from './components/ShareSite'
import { Stats } from './components/Stats'
import { StatsPage } from './components/StatsPage'
import {
  clearPendingCheckout,
  readPendingCheckout,
  savePendingCheckout,
  sleep,
} from './lib/checkout'
import {
  createBidCheckout,
  confirmCheckout,
  fetchBids,
  fetchLeaderboard,
  fetchSiteConfig,
  fetchVisitors,
  placeFreeBid,
  subscribeToLeaderboard,
  trackUniqueVisitor,
} from './lib/database'
import { isSupabaseConfigured } from './lib/supabase'
import {
  formatMoney,
  isValidWebsite,
  normalizeWebsite,
  websiteKey,
} from './lib/format'
import { MIN_SPONSOR_BID } from './lib/constants'
import { useOnlineCount } from './hooks/useOnlineCount'
import type { BidActivity, BidError, BidInput, BidResult, Character } from './types'

type Page = 'home' | 'stats'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [characters, setCharacters] = useState<Character[]>([])
  const [bids, setBids] = useState<BidActivity[]>([])
  const [visitors, setVisitors] = useState(0)
  const [freeBidsEnabled, setFreeBidsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [shareBid, setShareBid] = useState<{ website: string; rank: number } | null>(
    null,
  )
  const [flashId, setFlashId] = useState<string | null>(null)
  const [raiseWebsite, setRaiseWebsite] = useState<string | null>(null)
  const online = useOnlineCount()

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    try {
      const [nextCharacters, nextBids, visitorCount, siteConfig] = await Promise.all([
        fetchLeaderboard(),
        fetchBids(),
        fetchVisitors(),
        fetchSiteConfig(),
      ])
      setCharacters(nextCharacters)
      setBids(nextBids)
      setVisitors(visitorCount)
      setFreeBidsEnabled(siteConfig.freeBidsEnabled)
      setLoadError('')
      return nextCharacters
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load board.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
    const unsubscribe = subscribeToLeaderboard(() => {
      void refreshData()
    })
    return unsubscribe
  }, [refreshData])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void trackUniqueVisitor().then(setVisitors).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')

    if (checkout === 'cancelled') {
      clearPendingCheckout()
      setCheckoutMessage('Checkout cancelled. No charge was made.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (checkout !== 'success') return

    const sessionId = params.get('session_id')
    window.history.replaceState({}, '', window.location.pathname)
    const pending = readPendingCheckout()

    void (async () => {
      setCheckoutMessage('Payment received — confirming your spot on the board…')

      if (sessionId) {
        const confirmed = await confirmCheckout(sessionId)
        if (confirmed.error) {
          setCheckoutMessage(`Payment received, but board update failed: ${confirmed.error}`)
        }
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const nextCharacters = await refreshData()
        if (pending && nextCharacters) {
          const key = websiteKey(pending.website)
          const match = nextCharacters.find((c) => websiteKey(c.website) === key)
          // For raises, require the board amount to reflect the paid total
          if (match && match.amount >= pending.amount) {
            const rank = nextCharacters.findIndex((c) => c.id === match.id) + 1
            setShareBid({ website: pending.website, rank })
            setFlashId(match.id)
            setCheckoutMessage('Payment confirmed — you\'re on the board!')
            clearPendingCheckout()
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
        }
        await sleep(2000)
      }

      setCheckoutMessage('Payment received. Refresh the page if your bid is not visible yet.')
      clearPendingCheckout()
    })()
  }, [refreshData])

  const totalSpent = useMemo(
    () => bids.reduce((sum, bid) => sum + bid.paid, 0),
    [bids],
  )

  const placeBid = useCallback(
    async (input: BidInput): Promise<BidResult | BidError> => {
      const website = normalizeWebsite(input.website)
      const amount = input.amount

      if (!isValidWebsite(website)) {
        return { ok: false, error: 'Enter a valid website URL.' }
      }
      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        return { ok: false, error: 'Enter a whole-dollar amount.' }
      }
      if (amount < MIN_SPONSOR_BID) {
        return {
          ok: false,
          error: `Minimum bid is ${formatMoney(MIN_SPONSOR_BID)}.`,
        }
      }

      const key = websiteKey(website)
      const existing = characters.find((c) => websiteKey(c.website) === key) ?? null
      const tagline = existing ? existing.tagline : input.tagline.trim()

      if (!existing && !tagline) {
        return { ok: false, error: 'Add a one-line pitch.' }
      }

      if (existing && amount <= existing.amount) {
        return {
          ok: false,
          error: `Raise at least $1 above the current ${formatMoney(existing.amount)}.`,
        }
      }

      if (freeBidsEnabled) {
        const freeResult = await placeFreeBid({
          website,
          websiteKey: key,
          tagline,
          amount,
        })

        if (!freeResult.error) {
          await refreshData()
          const nextCharacters = await fetchLeaderboard()
          const match = nextCharacters.find((c) => websiteKey(c.website) === key)
          if (match) setFlashId(match.id)
          return {
            ok: true,
            free: true,
            projectedRank: freeResult.projectedRank,
          }
        }

        const freeDisabled = /disabled|stripe/i.test(freeResult.error)
        if (!freeDisabled) {
          return { ok: false, error: freeResult.error }
        }
      }

      const result = await createBidCheckout({ website, tagline, amount })

      if (result.error) {
        return { ok: false, error: result.error }
      }

      if (result.checkoutUrl) {
        savePendingCheckout({
          website,
          amount,
          projectedRank: result.projectedRank,
        })
        window.location.href = result.checkoutUrl
        return { ok: true, checkoutUrl: result.checkoutUrl, projectedRank: result.projectedRank }
      }

      return {
        ok: false,
        error: 'Could not start payment. Check Stripe configuration.',
      }
    },
    [characters, freeBidsEnabled, refreshData],
  )

  const handleBidSuccess = useCallback(
    ({ website, rank, listingId }: { website: string; rank: number; listingId?: string }) => {
      setShareBid({ website, rank })
      if (listingId) setFlashId(listingId)
      else {
        const key = websiteKey(website)
        const match = characters.find((c) => websiteKey(c.website) === key)
        if (match) setFlashId(match.id)
      }
    },
    [characters],
  )

  const handleRaise = useCallback((website: string) => {
    setPage('home')
    setRaiseWebsite(website)
  }, [])

  const goHome = () => {
    setPage('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goStats = () => {
    setPage('stats')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <PageBackground />
      <div className="app">
      <nav className="topnav" aria-label="Primary">
        <button type="button" className="brand" onClick={goHome} aria-label="cupbid home">
          <BrandLogo />
        </button>
      </nav>

      {loadError ? (
        <aside className="config-banner" role="alert">
          <p>{loadError}</p>
        </aside>
      ) : null}

      {checkoutMessage ? (
        <aside className="config-banner is-soft" role="status">
          <p>{checkoutMessage}</p>
        </aside>
      ) : null}

      {page === 'stats' ? (
        <StatsPage
          characters={characters}
          bids={bids}
          visitors={visitors}
          online={online}
          onBack={goHome}
        />
      ) : loading ? (
        <p className="muted loading-board">Loading board…</p>
      ) : (
        <main id="main-content">
          <Hero
            top={characters[0] ?? null}
            characters={characters}
            online={online}
            visitors={visitors}
            prefillWebsite={raiseWebsite}
            onSeeStats={goStats}
            onSubmit={placeBid}
            onBidSuccess={handleBidSuccess}
            onPrefillApplied={() => setRaiseWebsite(null)}
          />

          {shareBid ? (
            <ShareCard website={shareBid.website} rank={shareBid.rank} />
          ) : null}

          <div id="stats">
            <Stats
              totalCharacters={characters.length}
              totalSpent={totalSpent}
              totalBids={bids.length}
            />
          </div>

          <div id="board">
            <Leaderboard
              characters={characters}
              flashId={flashId}
              onRaise={handleRaise}
            />
          </div>

          <div id="how">
            <HowItWorks />
          </div>
        </main>
      )}

      <footer className="footer">
        <ShareSite />
        <p>cupbid.lol · Pay to rank your website · No bid limit</p>
      </footer>
      </div>
    </>
  )
}
