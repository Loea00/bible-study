import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setStatus('error')
    }
    // On success, the auth listener in AuthContext picks up the new session
    // and AppShell re-renders past this component.
  }

  return (
    <div className="signin">
      <h1>Bible Study</h1>
      <p>Sign in to continue.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {status === 'error' && error && <p className="error">{error}</p>}
    </div>
  )
}
