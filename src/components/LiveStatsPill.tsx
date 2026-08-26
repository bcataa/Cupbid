import { useEffect, useState } from 'react'

interface LiveStatsPillProps {
  online: number
  visitors: number
  onSeeStats: () => void
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function LiveStatsPill({ online, visitors, onSeeStats }: LiveStatsPillProps) {
  const [shownOnline, setShownOnline] = useState(online)

  useEffect(() => {
    const id = window.setInterval(() => {
      setShownOnline((value) => {
        const drift = Math.floor(Math.random() * 7) - 3
        return Math.max(12, value + drift)
      })
    }, 4000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <button
      type="button"
      className="live-stats-pill"
      onClick={onSeeStats}
      aria-label="See live stats"
    >
      <span className="live-stats-online">
        <span className="live-stats-dot" aria-hidden="true" />
        {formatCount(shownOnline)} online
      </span>
      <span className="live-stats-sep" aria-hidden="true">
        ·
      </span>
      <span className="live-stats-visitors">
        {formatCount(visitors)} visitors since launch
      </span>
      <span className="live-stats-sep" aria-hidden="true">
        ·
      </span>
      <span className="live-stats-cta">see stats →</span>
    </button>
  )
}
