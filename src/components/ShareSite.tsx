import { useState } from 'react'
import { SHARE_TEXT, SITE_URL } from '../lib/site'

export function ShareSite() {
  const [copied, setCopied] = useState(false)
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', SITE_URL)
    }
  }

  return (
    <div className="share-site">
      <p className="share-site-label">Help others find the cup</p>
      <div className="share-site-actions">
        <a className="btn share-btn" href={tweetHref} target="_blank" rel="noreferrer">
          Share on X
        </a>
        <button type="button" className="btn share-btn" onClick={() => void copyLink()}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
