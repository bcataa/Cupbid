import { displayHost } from '../lib/format'

interface ShareCardProps {
  website: string
  rank: number
}

export function ShareCard({ website, rank }: ShareCardProps) {
  const host = displayHost(website)
  const text =
    rank === 1
      ? `I just took the #1 cup on cupbid.lol and sponsored ${host}.`
      : `I just ranked #${rank} on cupbid.lol with ${host}.`
  const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`

  return (
    <section className="share" aria-live="polite">
      <p className="eyebrow">Free distribution</p>
      <h2>{text}</h2>
      <p className="muted">{host}</p>
      <a className="btn primary" href={href} target="_blank" rel="noreferrer">
        Share on X
      </a>
    </section>
  )
}
