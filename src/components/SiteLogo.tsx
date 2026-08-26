import { useState } from 'react'
import { logoUrlForWebsite } from '../lib/format'

interface SiteLogoProps {
  website: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export function SiteLogo({ website, name, size = 'md' }: SiteLogoProps) {
  const [failed, setFailed] = useState(false)
  const src = logoUrlForWebsite(website, size === 'lg' ? 128 : 64)
  const initials = name.replace(/^@/, '').slice(0, 2).toUpperCase() || '??'

  if (!src || failed) {
    return (
      <span className={`site-logo is-${size} is-fallback`} aria-hidden="true">
        {initials}
      </span>
    )
  }

  return (
    <img
      className={`site-logo is-${size}`}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
