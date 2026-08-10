import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Reached two ways: (1) via the link in a password-reset email — Supabase
// appends a recovery token to the redirect URL's hash, which supabase-js
// parses on load into a temporary session, so by the time this renders the
// user is already "signed in" enough for updateUser to work; (2) by an
// already-signed-in user choosing "Change password" from Settings. Same
// form serves both — updateUser({ password }) only needs *a* valid
// session, it doesn't care which kind.
export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("The two entries don't match.")
      return
    }
    setStatus('saving')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setStatus('error')
      return
    }
    setStatus('done')
  }

  return (
    <div className="signin">
      <h1>THEO</h1>
      {status === 'done' ? (
        <>
          <p>Your password has been updated.</p>
          <button type="button" onClick={() => navigate('/')}>
            Continue
          </button>
        </>
      ) : (
        <>
          <p>Set a new password.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Update password'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  )
}
