import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrandLogo } from './components/BrandLogo'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Leaderboard } from './components/Leaderboard'
import { LogoGallery } from './components/LogoGallery'
import { PageBackground } from './components/PageBackground'
import { ShareCard } from './components/ShareCard'
import { ShareSite } from './components/ShareSite'
import { Stats } from './components/Stats'
import { StatsPage } from './components/StatsPage'
import {
  createBidCheckout,
  fetchBids,
  fetchLeaderboard,
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

type Page = 'home' | 'stats' | 'logos'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [characters, setCharacters] = useState<Character[]>([])
  const [bids, setBids] = useState<BidActivity[]>([])
  const [visitors, setVisitors] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [shareBid, setShareBid] = useState<{ website: string; rank: number } | null>(
    null,
  )
  const online = useOnlineCount()

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    try {
      const [nextCharacters, nextBids, visitorCount] = await Promise.all([
        fetchLeaderboard(),
        fetchBids(),
        fetchVisitors(),
      ])
      setCharacters(nextCharacters)
      setBids(nextBids)
      setVisitors(visitorCount)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load board.')
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
    if (params.get('checkout') === 'success') {
      setCheckoutMessage('Payment received. Your bid will appear once confirmed.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('checkout') === 'cancelled') {
      setCheckoutMessage('Checkout cancelled. No charge was made.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const totalSpent = useMemo(
    () => bids.reduce((sum, bid) => sum + bid.paid, 0),
    [bids],
  )

  const placeBid = useCallback(
    async (input: BidInput): Promise<BidResult | BidError> => {
      const website = normalizeWebsite(input.website)
      const tagline = input.tagline.trim()
      const amount = input.amount

      if (!isValidWebsite(website)) {
        return { ok: false, error: 'Enter a valid website URL.' }
      }
      if (!tagline) return { ok: false, error: 'Add a one-line pitch.' }
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
      if (existing && amount <= existing.amount) {
        return {
          ok: false,
          error: `Raise at least $1 above the current ${formatMoney(existing.amount)}.`,
        }
      }

      // Free test bids first (no Stripe). Falls back to checkout when free mode is off.
      const freeResult = await placeFreeBid({
        website,
        websiteKey: key,
        tagline,
        amount,
      })

      if (!freeResult.error) {
        await refreshData()
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

      const result = await createBidCheckout({ website, tagline, amount })

      if (result.error) {
        return { ok: false, error: result.error }
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return { ok: true, checkoutUrl: result.checkoutUrl, projectedRank: result.projectedRank }
      }

      if (result.free) {
        await refreshData()
        return { ok: true, free: true, projectedRank: result.projectedRank }
      }

      return {
        ok: false,
        error: 'Payments are not live yet. Stripe is being connected.',
      }
    },
    [characters, refreshData],
  )

  const goHome = () => {
    setPage('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goStats = () => {
    setPage('stats')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goLogos = () => {
    setPage('logos')
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
      ) : page === 'logos' ? (
        <LogoGallery onBack={goHome} />
      ) : loading ? (
        <p className="muted loading-board">Loading board…</p>
      ) : (
        <main id="main-content">
          <Hero
            key={
              characters[0]
                ? `${characters[0].id}-${characters[0].amount}`
                : 'empty'
            }
            top={characters[0] ?? null}
            characters={characters}
            online={online}
            visitors={visitors}
            onSeeStats={goStats}
            onSubmit={placeBid}
            onBidSuccess={setShareBid}
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
            <Leaderboard characters={characters} flashId={null} />
          </div>

          <div id="how">
            <HowItWorks />
          </div>
        </main>
      )}

      <footer className="footer">
        <ShareSite />
        <button type="button" className="footer-link" onClick={goLogos}>
          Logo options
        </button>
        <p>cupbid.lol · Pay to rank your website · No bid limit</p>
      </footer>
      </div>
    </>
  )
}
