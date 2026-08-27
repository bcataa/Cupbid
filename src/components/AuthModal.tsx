import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
}

export function AuthModal({ open, onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)

    try {
      if (mode === 'signup') {
        const err = await signUp(email, password, username)
        if (err) {
          setError(err)
          return
        }
        setMessage('Account created. Check your email if confirmation is required, then log in.')
        setMode('login')
        return
      }

      const err = await signIn(email, password)
      if (err) {
        setError(err)
        return
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" role="presentation" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-labelledby="auth-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="auth-title">{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Log in to pay and rank your website.'
            : 'Sign up with email and a unique username.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
              aria-label="Username"
            />
          ) : null}
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-label="Password"
          />
          <button type="submit" className="btn primary auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="auth-message">{message}</p> : null}

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            className="nav-text-btn"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
