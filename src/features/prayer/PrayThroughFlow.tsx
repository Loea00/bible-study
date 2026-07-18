import { useState } from 'react'
import type { PrayerRequest } from '../../types/db'

interface PrayThroughFlowProps {
  listName: string
  requests: PrayerRequest[]
  onMark: (requestId: string) => Promise<unknown>
  onExit: () => void
}

// "A designed prayer session, not a checklist grind" (spec-amendment-v1-2
// §B4) — step through one request at a time, exit anytime, no completion
// framing (no confetti/"you did it" at the end, just a quiet statement).
export function PrayThroughFlow({ listName, requests, onMark, onExit }: PrayThroughFlowProps) {
  const [index, setIndex] = useState(0)
  const [marking, setMarking] = useState(false)

  const current = requests[index]

  async function handleMark() {
    if (!current) return
    setMarking(true)
    try {
      await onMark(current.id)
      setIndex((i) => i + 1)
    } catch {
      // Swallow — same pattern as the card's own mark button; a failed
      // mark here shouldn't strand the user mid-flow. They can retry or exit.
    } finally {
      setMarking(false)
    }
  }

  function handleSkip() {
    setIndex((i) => i + 1)
  }

  return (
    <div className="pray-through">
      <div className="pray-through-header">
        <p className="pray-through-list-name">{listName}</p>
        <button type="button" className="pray-through-exit" onClick={onExit}>
          Exit
        </button>
      </div>

      {requests.length === 0 && (
        <p className="placeholder">Nothing to pray through in {listName} right now.</p>
      )}

      {requests.length > 0 && current && (
        <div className="pray-through-card">
          <p className="pray-through-progress">
            {index + 1} of {requests.length}
          </p>
          <h2 className="pray-through-title">{current.title}</h2>
          {current.description && <p className="entry-body">{current.description}</p>}
          <div className="pray-through-actions">
            <button type="button" onClick={handleMark} disabled={marking}>
              {marking ? 'Marking…' : 'I prayed for this'}
            </button>
            <button type="button" className="pray-through-skip" onClick={handleSkip} disabled={marking}>
              Skip
            </button>
          </div>
        </div>
      )}

      {requests.length > 0 && !current && (
        <div className="pray-through-card">
          <p className="entry-body">That's everyone in {listName}.</p>
          <button type="button" onClick={onExit}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
