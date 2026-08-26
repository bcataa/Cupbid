import { useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'
import type { BidActivity, Character } from '../types'

interface StatsPageProps {
  characters: Character[]
  bids: BidActivity[]
  visitors: number
  online: number
  onBack: () => void
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <article className="stat-card">
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
      {note ? <p className="stat-card-note">{note}</p> : null}
    </article>
  )
}

export function StatsPage({
  characters,
  bids,
  visitors,
  online,
  onBack,
}: StatsPageProps) {
  const [now] = useState(() => Date.now())

  const metrics = useMemo(() => {
    const hourAgo = now - 1000 * 60 * 60
    const dayAgo = now - 1000 * 60 * 60 * 24
    const bidsHour = bids.filter((bid) => bid.createdAt >= hourAgo)
    const bidsDay = bids.filter((bid) => bid.createdAt >= dayAgo)
    const paidAll = bids.reduce((sum, bid) => sum + bid.paid, 0)
    const paidHour = bidsHour.reduce((sum, bid) => sum + bid.paid, 0)
    const paidDay = bidsDay.reduce((sum, bid) => sum + bid.paid, 0)
    const biggest = bids.reduce((max, bid) => Math.max(max, bid.paid), 0)
    const viewsAllTime = Math.max(visitors, paidAll * 120)
    const viewsDay = Math.max(40, Math.round(viewsAllTime * 0.068))
    const viewsHour = Math.max(6, Math.round(viewsDay * 0.022))

    return {
      bidsHour,
      bidsDay,
      paidAll,
      paidHour,
      paidDay,
      biggest,
      viewsAllTime,
      viewsDay,
      viewsHour,
    }
  }, [bids, visitors, now])

  return (
    <div className="stats-page">
      <header className="stats-page-top">
        <button type="button" className="stats-back" onClick={onBack}>
          ← Back to board
        </button>
        <h1>Stats</h1>
        <p className="muted">Live mock numbers from the board.</p>
      </header>

      <section className="stats-block" aria-labelledby="traffic-title">
        <div className="stats-block-head">
          <h2 id="traffic-title">Traffic</h2>
          <p>Page views of the board and this page.</p>
        </div>
        <div className="stats-grid">
          <StatCard label="Views, last 24h" value={formatCount(metrics.viewsDay)} />
          <StatCard label="Views, this hour" value={formatCount(metrics.viewsHour)} />
          <StatCard label="Views, all time" value={formatCount(metrics.viewsAllTime)} />
          <StatCard
            label="People here now"
            value={formatCount(online)}
            note={`${formatCount(Math.max(online, metrics.viewsHour))} in the last hour`}
          />
        </div>
      </section>

      <section className="stats-block" aria-labelledby="money-title">
        <div className="stats-block-head">
          <h2 id="money-title">Money</h2>
          <p>What people paid to climb the cup.</p>
        </div>
        <div className="stats-grid">
          <StatCard label="Sites ranked" value={formatCount(characters.length)} />
          <StatCard
            label="Revenue, all time"
            value={formatMoney(metrics.paidAll)}
            note={`${formatCount(metrics.paidAll)} dollars paid for rank`}
          />
          <StatCard label="Payments, all time" value={formatCount(bids.length)} />
          <StatCard
            label="Biggest single purchase"
            value={formatMoney(metrics.biggest)}
            note={`${formatCount(metrics.biggest)} dollars in one checkout`}
          />
          <StatCard
            label="Revenue, last 24h"
            value={formatMoney(metrics.paidDay)}
            note={`${formatCount(metrics.bidsDay.length)} payments`}
          />
          <StatCard
            label="Revenue, last hour"
            value={formatMoney(metrics.paidHour)}
            note={`${formatCount(metrics.bidsHour.length)} payments`}
          />
        </div>
      </section>
    </div>
  )
}
