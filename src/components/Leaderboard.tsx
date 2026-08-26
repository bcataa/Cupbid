import { displayHost, formatMoney } from '../lib/format'
import type { Character } from '../types'
import { SiteLogo } from './SiteLogo'

interface LeaderboardProps {
  characters: Character[]
  flashId: string | null
}

function Row({
  character,
  rank,
  flash,
}: {
  character: Character
  rank: number
  flash: boolean
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
      <span className="amount">{formatMoney(character.amount)}</span>
    </li>
  )
}

export function Leaderboard({ characters, flashId }: LeaderboardProps) {
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
            />
          ))}
        </ol>
      )}
    </section>
  )
}
