import { useCallback, useMemo, useState } from 'react'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Leaderboard } from './components/Leaderboard'
import { ShareCard } from './components/ShareCard'
import { Stats } from './components/Stats'
import { StatsPage } from './components/StatsPage'
import {
  INITIAL_BID_COUNT,
  MIN_SPONSOR_BID,
  MOCK_BID_HISTORY,
  MOCK_CHARACTERS,
} from './data/mockCharacters'
import {
  displayHost,
  formatMoney,
  isValidWebsite,
  normalizeUsername,
  normalizeWebsite,
  sortByAmount,
  websiteKey,
} from './lib/format'
import type { BidActivity, BidError, BidInput, BidResult, Character } from './types'

type Page = 'home' | 'stats'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [characters, setCharacters] = useState<Character[]>(() =>
    sortByAmount(MOCK_CHARACTERS),
  )
  const [bids, setBids] = useState<BidActivity[]>(() => [...MOCK_BID_HISTORY])
  const [totalBids, setTotalBids] = useState(INITIAL_BID_COUNT)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [lastWin, setLastWin] = useState<{
    username: string
    website: string
    rank: number
  } | null>(null)
  const [demotion, setDemotion] = useState<{
    victim: string
    winner: string
  } | null>(null)
  const [visitors, setVisitors] = useState(1329753)
  const [online] = useState(457)

  const totalSpent = useMemo(
    () => characters.reduce((sum, character) => sum + character.amount, 0),
    [characters],
  )

  const placeBid = useCallback(
    (input: BidInput): BidResult | BidError => {
      const website = normalizeWebsite(input.website)
      const username =
        normalizeUsername(input.username) ||
        displayHost(website).split('.')[0] ||
        ''
      const tagline = input.tagline.trim()
      const amount = input.amount

      if (!isValidWebsite(website)) {
        return { ok: false, error: 'Enter a valid website URL.' }
      }
      if (!username) return { ok: false, error: 'Enter a valid website URL.' }
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
      const existing =
        characters.find((c) => websiteKey(c.website) === key) ??
        characters.find((c) => c.username === username) ??
        null
      const previousRank = existing
        ? characters.findIndex((c) => c.id === existing.id) + 1
        : null
      const previousLeader = characters[0] ?? null
      const previousAmount = existing?.amount ?? 0

      if (existing && amount <= existing.amount) {
        return {
          ok: false,
          error: `Raise at least $1 above your current ${formatMoney(existing.amount)}.`,
        }
      }

      const nextCharacter: Character = existing
        ? {
            ...existing,
            amount,
            website,
            tagline,
            username: existing.username,
          }
        : { id: crypto.randomUUID(), username, website, tagline, amount }

      const nextList = sortByAmount([
        ...characters.filter((c) => c.id !== nextCharacter.id),
        nextCharacter,
      ])

      const rank = nextList.findIndex((c) => c.id === nextCharacter.id) + 1
      const newLeader = nextList[0]
      const demoted =
        previousLeader &&
        newLeader &&
        previousLeader.id !== newLeader.id &&
        newLeader.id === nextCharacter.id
          ? previousLeader
          : null

      const activity: BidActivity = {
        id: crypto.randomUUID(),
        username,
        website,
        amount,
        paid: amount - previousAmount,
        rank,
        previousRank,
        tookCup: Boolean(demoted) || (rank === 1 && previousRank !== 1),
        createdAt: Date.now(),
      }

      setCharacters(nextList)
      setBids((prev) => [activity, ...prev])
      setTotalBids((count) => count + 1)
      setVisitors((count) => count + Math.floor(Math.random() * 3) + 1)
      setFlashId(nextCharacter.id)
      setLastWin({ username, website, rank })
      setDemotion(
        demoted
          ? {
              victim: displayHost(demoted.website),
              winner: displayHost(website),
            }
          : null,
      )
      window.setTimeout(() => setFlashId(null), 1200)

      return {
        ok: true,
        rank,
        username,
        website,
        amount,
        demoted,
        previousRank,
      }
    },
    [characters],
  )

  const goHome = () => {
    setPage('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goStats = () => {
    setPage('stats')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <nav className="topnav" aria-label="Primary">
        <button type="button" className="brand" onClick={goHome}>
          <img
            className="brand-mark"
            src="/cupbid-logo.png"
            alt=""
            width={32}
            height={32}
          />
          cupbid<span>.lol</span>
        </button>
        <div className="nav-links">
          {page === 'home' ? (
            <>
              <a href="#board">Leaderboard</a>
              <a href="#how">How it works</a>
            </>
          ) : (
            <button type="button" className="nav-text-btn" onClick={goHome}>
              Board
            </button>
          )}
          <button type="button" className="nav-text-btn" onClick={goStats}>
            Stats
          </button>
        </div>
      </nav>

      {page === 'stats' ? (
        <StatsPage
          characters={characters}
          bids={bids}
          visitors={visitors}
          online={online}
          onBack={goHome}
        />
      ) : (
        <>
          <Hero
            key={characters[0]?.id ?? 'empty'}
            top={characters[0] ?? null}
            characters={characters}
            online={online}
            visitors={visitors}
            onSeeStats={goStats}
            onSubmit={placeBid}
          />

          <div id="stats">
            <Stats
              totalCharacters={characters.length}
              totalSpent={totalSpent}
              totalBids={totalBids}
            />
          </div>

          <div id="board">
            <Leaderboard characters={characters} flashId={flashId} />
          </div>

          <div id="how">
            <HowItWorks />
          </div>

          {demotion ? (
            <aside className="demotion" role="status" aria-live="assertive">
              <p className="demotion-title">💀 You&apos;ve been demoted.</p>
              <p>
                {demotion.winner} just took the cup from {demotion.victim}.
              </p>
            </aside>
          ) : null}

          {lastWin ? (
            <ShareCard
              username={lastWin.username}
              website={lastWin.website}
              rank={lastWin.rank}
            />
          ) : null}
        </>
      )}

      <footer className="footer">
        <p>cupbid.lol · Pay to rank your website · No bid limit</p>
      </footer>
    </div>
  )
}
