import { useState } from 'react'
import { usePrayerShares } from './usePrayerShares'
import type { PrayerVisibility } from '../../types/db'

interface PrayerShareControlsProps {
  requestId: string
  friends: { id: string; name: string }[]
  onVisibilityChange: (visibility: PrayerVisibility) => Promise<unknown>
}

// Mounted only while the card's share panel is open (see
// PrayerRequestCard.tsx) — the shares fetch stays lazy rather than firing
// for every card up front.
export function PrayerShareControls({ requestId, friends, onVisibilityChange }: PrayerShareControlsProps) {
  const { shares, loading, shareWith, unshareWith } = usePrayerShares(requestId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sharedIds = new Set(shares.map((s) => s.shared_with_id))

  async function handleToggle(friendId: string) {
    setBusyId(friendId)
    setError(null)
    try {
      const existing = shares.find((s) => s.shared_with_id === friendId)
      if (existing) {
        await unshareWith(existing.id)
        if (shares.length === 1) await onVisibilityChange('private')
      } else {
        await shareWith(friendId)
        await onVisibilityChange('shared')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.')
    } finally {
      setBusyId(null)
    }
  }

  if (friends.length === 0) {
    return <p className="placeholder">Add a friend first (see the Friends page) to share this request.</p>
  }

  return (
    <div className="prayer-share-controls">
      {loading && <p className="placeholder">Loading…</p>}
      {!loading &&
        friends.map((f) => (
          <label key={f.id} className="prayer-share-friend">
            <input
              type="checkbox"
              checked={sharedIds.has(f.id)}
              disabled={busyId === f.id}
              onChange={() => handleToggle(f.id)}
            />
            {f.name}
          </label>
        ))}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
