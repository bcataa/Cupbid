interface LiveStatsPillProps {
  online: number
  visitors: number
  onSeeStats: () => void
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function LiveStatsPill({ online, visitors, onSeeStats }: LiveStatsPillProps) {
  return (
    <button
      type="button"
      className="live-stats-pill"
      onClick={onSeeStats}
      aria-label="See live stats"
    >
      <span className="live-stats-online">
        <span className="live-stats-dot" aria-hidden="true" />
        {formatCount(online)} online
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
