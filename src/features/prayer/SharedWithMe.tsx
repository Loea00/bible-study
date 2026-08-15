import { useState } from 'react'
import { useSharedWithMe } from './useSharedWithMe'
import { usePrayedMarks } from './usePrayedMarks'
import { useEncouragement } from './useEncouragement'
import { useModeration } from '../friends/useModeration'
import type { PrayerRequest } from '../../types/db'

// Requests friends have shared with you (spec-amendment-v1-2 §B7.1) — a
// read-only view of someone else's request: no edit/delete/status
// controls (those stay owner-only), just praying-for-it and encouragement.
export function SharedWithMe() {
  const { requests, ownersById, loading } = useSharedWithMe()
  const { marksByRequest, addMark } = usePrayedMarks()

  if (loading) return <p className="placeholder">Loading…</p>
  if (requests.length === 0) return null

  return (
    <section className="settings-section">
      <h2>Shared with me</h2>
      <div className="journal-timeline">
        {requests.map((r) => (
          <SharedRequestCard
            key={r.id}
            request={r}
            ownerName={ownersById[r.user_id]?.display_name || ownersById[r.user_id]?.full_name || 'A friend'}
            marks={marksByRequest[r.id] ?? []}
            onMarkPrayed={addMark}
          />
        ))}
      </div>
    </section>
  )
}

function SharedRequestCard({
  request,
  ownerName,
  marks,
  onMarkPrayed,
}: {
  request: PrayerRequest
  ownerName: string
  marks: { id: string; created_at: string }[]
  onMarkPrayed: (requestId: string) => Promise<unknown>
}) {
  const [marking, setMarking] = useState(false)
  const [encouragementOpen, setEncouragementOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { reportContent } = useModeration()
  const [reporting, setReporting] = useState(false)

  async function handleMark() {
    setMarking(true)
    setError(null)
    try {
      await onMarkPrayed(request.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setMarking(false)
    }
  }

  async function handleReport() {
    setReporting(true)
    setError(null)
    try {
      await reportContent('prayer_request', request.id, '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that report.')
    } finally {
      setReporting(false)
    }
  }

  return (
    <article className="prayer-card">
      <div className="journal-card-header">
        <div>
          <p className="journal-card-date">Shared by {ownerName}</p>
          <h2>{request.title}</h2>
        </div>
        <div className="journal-card-actions">
          <button type="button" className="journal-card-delete" onClick={handleReport} disabled={reporting}>
            {reporting ? 'Reporting…' : 'Report'}
          </button>
        </div>
      </div>

      {request.description && <p className="entry-body">{request.description}</p>}

      <div className="prayer-mark-row">
        <button type="button" className="prayer-mark-button" onClick={handleMark} disabled={marking}>
          {marking ? 'Marking…' : 'I prayed for this'}
        </button>
        <span className="prayer-mark-whisper">{marks.length === 0 ? 'Not marked yet' : 'You prayed for this'}</span>
      </div>

      <button type="button" className="anchor-scripture-toggle" onClick={() => setEncouragementOpen((o) => !o)}>
        {encouragementOpen ? '▲ Hide encouragement' : '▾ Encouragement'}
      </button>
      {encouragementOpen && <SharedEncouragement requestId={request.id} />}

      {error && <p className="error">{error}</p>}
    </article>
  )
}

function SharedEncouragement({ requestId }: { requestId: string }) {
  const { entries, authorsById, loading, addEncouragement } = useEncouragement(requestId)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      await addEncouragement(body)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="prayer-encouragement">
      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && <p className="placeholder">No encouragement yet — be the first.</p>}
      {entries.map((e) => (
        <div key={e.id} className="prayer-encouragement-entry">
          <p className="prayer-encouragement-author">
            {authorsById[e.user_id]?.display_name || authorsById[e.user_id]?.full_name || 'A friend'}
          </p>
          <p className="entry-body">{e.body}</p>
        </div>
      ))}
      <div className="prayer-encouragement-form">
        <textarea
          value={body}
          onChange={(ev) => setBody(ev.target.value)}
          rows={2}
          placeholder="Write a word of encouragement…"
        />
        <button type="button" onClick={handleSend} disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
