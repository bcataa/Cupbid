const OPTIONS = [
  {
    id: 'ring',
    name: 'Ring mark',
    note: 'Like your aurabid reference — clean and neutral.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#ffffff" />
        <circle cx="16" cy="16" r="7" stroke="#1e4d42" strokeWidth="4" fill="none" />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-dark',
  },
  {
    id: 'cup',
    name: 'Cup trophy',
    note: 'Matches “pay for the cup” — coral accent.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#ffffff" />
        <path
          d="M10 11h12v2.2c0 3.6-2.4 6.4-6 6.4s-6-2.8-6-6.4V11z"
          fill="#e85d4c"
        />
        <path d="M13 20.5h6v1.8H13z" fill="#e85d4c" />
        <path d="M12 22.8h8v1.5H12z" fill="#e85d4c" />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-dark',
  },
  {
    id: 'monogram',
    name: 'C monogram',
    note: 'Bold letter mark — strong at small sizes.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#e85d4c" />
        <path
          d="M20.5 11.2A6.8 6.8 0 0 0 16 9.5a6.9 6.9 0 1 0 0 13.8c1.8 0 3.4-.7 4.5-1.8"
          stroke="#ffffff"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-dark',
  },
  {
    id: 'domain',
    name: 'cupbid.lol',
    note: 'Current site domain split — coral suffix.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#ffffff" />
        <path d="M9 21V11h3.2l2.8 6.8L17.8 11H21v10h-2.6v-6.3L15.8 21h-1.6l-2.6-6.3V21H9z" fill="#1a1816" />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-split',
  },
  {
    id: 'podium',
    name: 'Rank podium',
    note: 'Leaderboard vibe — pay to rank.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#ffffff" />
        <rect x="8" y="18" width="5" height="7" rx="1" fill="#d4ccc4" />
        <rect x="13.5" y="13" width="5" height="12" rx="1" fill="#e85d4c" />
        <rect x="19" y="20" width="5" height="5" rx="1" fill="#d4ccc4" />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-dark',
  },
  {
    id: 'aura',
    name: 'Aura ring',
    note: 'Soft glow ring — closer to aurabid feel.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#ffffff" />
        <circle cx="16" cy="16" r="9" stroke="#fde8e4" strokeWidth="3" fill="none" />
        <circle cx="16" cy="16" r="6" stroke="#1e4d42" strokeWidth="3.5" fill="none" />
      </svg>
    ),
    wordmark: 'cupbid',
    wordmarkClass: 'is-dark',
  },
] as const

export function LogoGallery({ onBack }: { onBack: () => void }) {
  return (
    <section className="logo-gallery" aria-labelledby="logo-gallery-title">
      <button type="button" className="stats-back" onClick={onBack}>
        ← Back to board
      </button>
      <div className="section-head">
        <h2 id="logo-gallery-title">Logo options</h2>
        <p>Pick a direction — tell me the name (e.g. “Ring mark” or “Cup trophy”).</p>
      </div>

      <ul className="logo-gallery-grid">
        {OPTIONS.map((option) => (
          <li key={option.id} className="logo-gallery-card">
            <div className="logo-gallery-preview">
              <span className="brand-icon">{option.icon}</span>
              <span className={`brand-name ${option.wordmarkClass}`}>
                {option.wordmark}
                {option.wordmarkClass === 'is-split' ? <span>.lol</span> : null}
              </span>
            </div>
            <strong>{option.name}</strong>
            <p>{option.note}</p>
          </li>
        ))}
      </ul>

      <div className="logo-gallery-images">
        <p className="eyebrow">AI concept previews</p>
        <div className="logo-gallery-image-grid">
          <figure>
            <img src="/logo-options/logo-option-ring.png" alt="Ring mark logo concept" />
            <figcaption>Ring mark</figcaption>
          </figure>
          <figure>
            <img src="/logo-options/logo-option-cup.png" alt="Cup trophy logo concept" />
            <figcaption>Cup trophy</figcaption>
          </figure>
          <figure>
            <img src="/logo-options/logo-option-monogram.png" alt="C monogram logo concept" />
            <figcaption>C monogram</figcaption>
          </figure>
          <figure>
            <img src="/logo-options/logo-option-rank.png" alt="Rank podium logo concept" />
            <figcaption>Rank / domain</figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
