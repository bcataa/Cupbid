import { formatMoney } from '../lib/format'

interface StatsProps {
  totalCharacters: number
  totalSpent: number
  totalBids: number
}

export function Stats({ totalCharacters, totalSpent, totalBids }: StatsProps) {
  return (
    <section className="stats" aria-label="Live sponsorship stats">
      <div>
        <p className="eyebrow">On the board</p>
        <strong>{totalCharacters}</strong>
      </div>
      <div>
        <p className="eyebrow">Total bid</p>
        <strong>{formatMoney(totalSpent)}</strong>
      </div>
      <div>
        <p className="eyebrow">Bids placed</p>
        <strong>{totalBids}</strong>
      </div>
    </section>
  )
}
