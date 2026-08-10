import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      setStatus('error')
      return
    }
    setStatus('sent')
  }

  return (
    <div className="signin">
      <h1>THEO</h1>
      {status === 'sent' ? (
        <p>If an account exists for that email, a reset link is on its way — check your inbox.</p>
      ) : (
        <>
          <p>Enter your email and we'll send a link to reset your password.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          {status === 'error' && error && <p className="error">{error}</p>}
        </>
      )}
      <p className="signin-links">
        <Link to="/">Back to sign in</Link>
      </p>
    </div>
  )
}
