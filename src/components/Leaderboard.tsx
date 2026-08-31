import { displayHost, formatMoney } from '../lib/format'
import type { Character } from '../types'
import { SiteLogo } from './SiteLogo'

interface LeaderboardProps {
  characters: Character[]
  flashId: string | null
  onRaise?: (website: string) => void
}

function Row({
  character,
  rank,
  flash,
  onRaise,
}: {
  character: Character
  rank: number
  flash: boolean
  onRaise?: (website: string) => void
}) {
  const host = displayHost(character.website)

  return (
    <li className={['row', flash ? 'is-flash' : ''].filter(Boolean).join(' ')}>
      <span className="rank-bubble" aria-label={`Rank ${rank}`}>
        #{rank}
      </span>
      <SiteLogo website={character.website} name={host} size="md" />
      <div className="who">
        <div className="who-top">
          <a
            className="site-title"
            href={character.website}
            target="_blank"
            rel="noreferrer"
          >
            {host}
          </a>
        </div>
        <p className="tagline">{character.tagline}</p>
      </div>
      <div className="row-actions">
        <span className="amount">{formatMoney(character.amount)}</span>
        {onRaise ? (
          <button
            type="button"
            className="btn raise-btn"
            onClick={() => onRaise(character.website)}
          >
            Raise
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function Leaderboard({ characters, flashId, onRaise }: LeaderboardProps) {
  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <div className="section-head">
        <h2 id="leaderboard-title">Leaderboard</h2>
        <p>Every bid on the board. Ranked by money spent.</p>
      </div>

      {characters.length === 0 ? (
        <p className="muted">No bids yet. Be the first.</p>
      ) : (
        <ol className="board">
          {characters.map((character, index) => (
            <Row
              key={character.id}
              character={character}
              rank={index + 1}
              flash={flashId === character.id}
              onRaise={onRaise}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
