import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types/db'

// Landing page for someone's personal /invite/<code> link. Doesn't preview
// who the link belongs to before accepting — the code alone doesn't grant
// read access to their profile until a friendship exists — so this stays a
// generic "add as a friend?" confirmation, then reveals the name once
// accept_invite() has created the relationship.
export function AcceptInvitePage() {
  const { code } = useParams<{ code: string }>()
  const [status, setStatus] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [friend, setFriend] = useState<Profile | null>(null)

  async function handleAccept() {
    if (!code) return
    setStatus('accepting')
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('accept_invite', { code })
      if (rpcError) throw new Error(rpcError.message)

      const { data: ownerData } = await supabase.from('profiles').select('*').eq('invite_code', code).maybeSingle()
      setFriend(ownerData)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this friend.')
      setStatus('error')
    }
  }

  return (
    <div className="signin">
      <h1>THEO</h1>
      {status === 'done' ? (
        <>
          <p>
            You're now friends with{' '}
            {friend?.display_name || friend?.full_name || 'them'}.
          </p>
          <Link to="/friends" className="settings-link-button">
            View friends
          </Link>
        </>
      ) : (
        <>
          <p>You've been invited to connect on THEO.</p>
          <button type="button" onClick={handleAccept} disabled={status === 'accepting' || !code}>
            {status === 'accepting' ? 'Adding…' : 'Add as a friend'}
          </button>
          {status === 'error' && error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  )
}
