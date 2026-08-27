import { displayHost } from '../lib/format'
import { SITE_URL } from '../lib/site'

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
  const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${SITE_URL}`)
    } catch {
      window.prompt('Copy this:', `${text} ${SITE_URL}`)
    }
  }

  return (
    <section className="share" aria-live="polite">
      <p className="eyebrow">You&apos;re on the board</p>
      <h2>{text}</h2>
      <p className="muted">{host}</p>
      <div className="share-site-actions">
        <a className="btn primary" href={href} target="_blank" rel="noreferrer">
          Share on X
        </a>
        <button type="button" className="btn share-btn" onClick={() => void copyText()}>
          Copy share text
        </button>
      </div>
    </section>
  )
}
