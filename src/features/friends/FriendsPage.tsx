import { useEffect, useState } from 'react'
import { useFriends } from './useFriends'
import { useModeration } from './useModeration'

function displayNameFor(profile: { display_name: string | null; full_name: string | null; email: string } | undefined): string {
  if (!profile) return 'Someone'
  return profile.display_name || profile.full_name || profile.email
}

export function FriendsPage() {
  const {
    loading,
    userId,
    incoming,
    outgoing,
    accepted,
    profilesById,
    searchResults,
    searching,
    searchError,
    searchUsers,
    sendRequest,
    acceptRequest,
    removeFriendship,
    inviteCode,
    loadInviteCode,
    acceptInvite,
  } = useFriends()
  const { blocks, profilesById: blockedProfilesById, blockUser, unblockUser } = useModeration()

  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [acceptingInvite, setAcceptingInvite] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => searchUsers(query), 300)
    return () => clearTimeout(id)
  }, [query, searchUsers])

  useEffect(() => {
    loadInviteCode().catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not load your invite link.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const relatedIds = new Set([
    ...incoming.map((f) => f.requester_id),
    ...outgoing.map((f) => f.addressee_id),
    ...accepted.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
  ])

  async function handleSendRequest(targetId: string) {
    setBusyId(targetId)
    setError(null)
    try {
      await sendRequest(targetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that request.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAccept(friendshipId: string) {
    setBusyId(friendshipId)
    setError(null)
    try {
      await acceptRequest(friendshipId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept that request.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(friendshipId: string) {
    setBusyId(friendshipId)
    setError(null)
    try {
      await removeFriendship(friendshipId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not do that.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleBlock(userId: string) {
    setBusyId(userId)
    setError(null)
    try {
      await blockUser(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block that person.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAcceptInviteLink() {
    const trimmed = inviteInput.trim()
    if (!trimmed) return
    // Accepts either a bare code or a full pasted /invite/<code> URL.
    const code = trimmed.includes('/invite/') ? trimmed.split('/invite/')[1].split(/[/?#]/)[0] : trimmed
    setAcceptingInvite(true)
    setError(null)
    try {
      await acceptInvite(code)
      setInviteInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that friend.')
    } finally {
      setAcceptingInvite(false)
    }
  }

  const inviteLink = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : null

  return (
    <div className="friends-page">
      <h1>Friends</h1>

      <section className="settings-section">
        <h2>Your invite link</h2>
        <p className="settings-hint">
          Share this link with someone directly — opening it while signed in adds you as friends right away, no
          separate approval step needed.
        </p>
        <div className="settings-form">
          <input type="text" readOnly value={inviteLink ?? 'Loading…'} onClick={(e) => e.currentTarget.select()} />
        </div>
      </section>

      <section className="settings-section">
        <h2>Add a friend via their link</h2>
        <p className="settings-hint">Paste an invite link (or just the code) someone shared with you.</p>
        <div className="settings-form">
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="Invite link or code"
          />
          <button type="button" onClick={handleAcceptInviteLink} disabled={acceptingInvite || !inviteInput.trim()}>
            {acceptingInvite ? 'Adding…' : 'Add friend'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Find someone</h2>
        <p className="settings-hint">Search by email (exact), display name, or real name.</p>
        <input
          type="search"
          className="journal-search-input"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <p className="placeholder">Searching…</p>}
        {searchError && <p className="error">{searchError}</p>}
        {!searching && query.trim() !== '' && searchResults.length === 0 && (
          <p className="placeholder">No one matches "{query.trim()}".</p>
        )}
        <div className="friends-list">
          {searchResults.map((r) => {
            const already = relatedIds.has(r.id)
            return (
              <div key={r.id} className="friends-row">
                <span className="friends-row-name">
                  {r.display_name || r.full_name || (r.email_match ? 'Matched by email' : 'Someone')}
                </span>
                <button type="button" onClick={() => handleSendRequest(r.id)} disabled={already || busyId === r.id}>
                  {already ? 'Already connected' : busyId === r.id ? 'Sending…' : 'Add friend'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {loading && <p className="placeholder">Loading…</p>}

      {!loading && incoming.length > 0 && (
        <section className="settings-section">
          <h2>Friend requests</h2>
          <div className="friends-list">
            {incoming.map((f) => (
              <div key={f.id} className="friends-row">
                <span className="friends-row-name">{displayNameFor(profilesById[f.requester_id])}</span>
                <div className="friends-row-actions">
                  <button type="button" onClick={() => handleAccept(f.id)} disabled={busyId === f.id}>
                    {busyId === f.id ? 'Accepting…' : 'Accept'}
                  </button>
                  <button type="button" onClick={() => handleRemove(f.id)} disabled={busyId === f.id}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && outgoing.length > 0 && (
        <section className="settings-section">
          <h2>Sent requests</h2>
          <div className="friends-list">
            {outgoing.map((f) => (
              <div key={f.id} className="friends-row">
                <span className="friends-row-name">{displayNameFor(profilesById[f.addressee_id])}</span>
                <button type="button" onClick={() => handleRemove(f.id)} disabled={busyId === f.id}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <section className="settings-section">
          <h2>Your friends</h2>
          {accepted.length === 0 && <p className="placeholder">No friends yet — search above or share your invite link.</p>}
          <div className="friends-list">
            {accepted.map((f) => {
              const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id
              return (
                <div key={f.id} className="friends-row">
                  <span className="friends-row-name">{displayNameFor(profilesById[otherId])}</span>
                  <div className="friends-row-actions">
                    <button type="button" onClick={() => handleRemove(f.id)} disabled={busyId === f.id}>
                      Unfriend
                    </button>
                    <button type="button" onClick={() => handleBlock(otherId)} disabled={busyId === otherId}>
                      Block
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {blocks.length > 0 && (
        <section className="settings-section">
          <h2>Blocked</h2>
          <div className="friends-list">
            {blocks.map((b) => (
              <div key={b.id} className="friends-row">
                <span className="friends-row-name">{displayNameFor(blockedProfilesById[b.blocked_id])}</span>
                <button type="button" onClick={() => unblockUser(b.id)}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
