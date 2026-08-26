import { MIN_SPONSOR_BID } from '../data/mockCharacters'
import { formatMoney } from '../lib/format'

export function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="section-head">
        <h2 id="how-title">How it works</h2>
        <p>Skip expensive ads. Bid once, get on the board, get clicks.</p>
      </div>
      <ol className="how-grid">
        <li>
          <strong>1. Paste your site</strong>
          <p>
            Drop your URL from {formatMoney(MIN_SPONSOR_BID)}. Your logo shows up
            live.
          </p>
        </li>
        <li>
          <strong>2. Pay to rank</strong>
          <p>Higher bid = higher spot. No max. Raise anytime with the same URL.</p>
        </li>
        <li>
          <strong>3. Get users</strong>
          <p>
            Visitors see the leaderboard and click through to your site — real
            traffic, not an ad auction.
          </p>
        </li>
      </ol>
    </section>
  )
}
