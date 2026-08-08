import { useState, type ReactNode } from 'react'

interface PrivateGateProps {
  isPrivate: boolean
  pinConfigured: boolean | null
  verifyPin: (pin: string) => Promise<boolean>
  children: ReactNode
  // Non-sensitive context (a date, a status badge) shown alongside the
  // unlock form so the user can tell which private item is which without
  // revealing its content -- kept as a separate prop rather than always
  // rendering the header, so callers control exactly what's safe to show
  // before unlock.
  placeholderMeta?: ReactNode
}

// Locked on every mount, by design (per-item, every time, not "stays
// unlocked for the session") -- navigating away and back re-locks.
// Deliberately does NOT expose a way to change privacy/edit/delete while
// locked -- those actions live inside `children`, so they're only
// reachable once the PIN has actually been entered correctly. Not
// encryption: see 0018_privacy_pin.sql -- this only withholds rendering
// the real content client-side until verify_privacy_pin confirms the PIN.
export function PrivateGate({ isPrivate, pinConfigured, verifyPin, children, placeholderMeta }: PrivateGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isPrivate || unlocked) return <>{children}</>

  async function handleUnlock() {
    if (!pin) return
    setChecking(true)
    setError(null)
    try {
      const ok = await verifyPin(pin)
      if (ok) {
        setUnlocked(true)
        setPin('')
      } else {
        setError('Incorrect PIN.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the PIN.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="private-gate">
      {placeholderMeta}
      <p className="private-gate-label">🔒 Private</p>
      {pinConfigured === false ? (
        <p className="placeholder">No privacy PIN is set, so this can't be unlocked — set one in Settings first.</p>
      ) : (
        <div className="private-gate-form">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter PIN"
          />
          <button type="button" onClick={handleUnlock} disabled={checking || !pin}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
