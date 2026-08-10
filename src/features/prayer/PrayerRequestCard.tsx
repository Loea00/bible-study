import { useEffect, useState } from 'react'
import type { PrayedMark, PrayerList, PrayerRequest, PrayerRequestStatus } from '../../types/db'
import { PrayerRequestHistory } from './PrayerRequestHistory'
import { PrivateGate } from '../../components/PrivateGate'
import { usePrayerGrounding } from './usePrayerGrounding'
import { PrayerGrounding } from './PrayerGrounding'

interface PrayerRequestCardProps {
  request: PrayerRequest
  lists: PrayerList[]
  marks: PrayedMark[]
  onEdit: (requestId: string, title: string, description: string, listId: string | null) => Promise<unknown>
  onSetStatus: (requestId: string, status: PrayerRequestStatus) => Promise<unknown>
  onMarkAnswered: (requestId: string, note: string) => Promise<unknown>
  onMarkPrayed: (requestId: string) => Promise<unknown>
  onDelete: (requestId: string) => Promise<void>
  onSetPrivacy: (requestId: string, isPrivate: boolean) => Promise<unknown>
  pinConfigured: boolean | null
  verifyPin: (pin: string) => Promise<boolean>
  // 'card' (default) renders the full card open, as it always has. 'list'
  // renders a compact checkable row that expands to the same full content
  // on click — the summary/detail split lives entirely in this component
  // so the two view modes share one source of truth for the card body.
  viewMode?: 'card' | 'list'
}

const STATUS_LABEL: Record<PrayerRequestStatus, string> = {
  active: 'Active',
  ongoing: 'Ongoing',
  answered: 'Answered',
  archived: 'Archived',
}

// "Last prayed" whisper (spec §B3) — a soft relative time, not a precise
// timestamp; exact times live in each dot's title attribute instead.
function formatRelative(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function PrayerRequestCard({
  request,
  lists,
  marks,
  onEdit,
  onSetStatus,
  onMarkAnswered,
  onMarkPrayed,
  onDelete,
  onSetPrivacy,
  pinConfigured,
  verifyPin,
  viewMode = 'card',
}: PrayerRequestCardProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(request.title)
  const [description, setDescription] = useState(request.description)
  const [listId, setListId] = useState(request.list_id ?? '')
  const [saving, setSaving] = useState(false)

  const [answering, setAnswering] = useState(false)
  const [answerNote, setAnswerNote] = useState('')

  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [togglingPrivacy, setTogglingPrivacy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [groundingOpen, setGroundingOpen] = useState(false)
  const { groups: groundingGroups, loading: groundingLoading, error: groundingError, load: loadGrounding } =
    usePrayerGrounding()
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(viewMode !== 'list')

  // Switching the page's view-mode toggle should collapse/expand every
  // already-mounted card, not just new ones — a plain useState initializer
  // only runs once at mount, so this keeps it in sync with the prop.
  useEffect(() => {
    setExpanded(viewMode !== 'list')
  }, [viewMode])

  function isToday(iso: string): boolean {
    const d = new Date(iso)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }
  const markedToday = marks.some((m) => isToday(m.created_at))

  function handleToggleGrounding() {
    const opening = !groundingOpen
    setGroundingOpen(opening)
    if (opening && groundingGroups === null) {
      loadGrounding(request.title, request.description)
    }
  }

  const date = new Date(request.created_at).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  function startEdit() {
    setTitle(request.title)
    setDescription(request.description)
    setListId(request.list_id ?? '')
    setError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onEdit(request.id, title, description, listId || null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetStatus(status: PrayerRequestStatus) {
    setBusy(true)
    setError(null)
    try {
      await onSetStatus(request.id, status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the status.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmAnswered() {
    setBusy(true)
    setError(null)
    try {
      await onMarkAnswered(request.id, answerNote)
      setAnswering(false)
      setAnswerNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this answered.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkPrayed() {
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

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(request.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the request.')
      setDeleting(false)
    }
  }

  async function handleTogglePrivacy() {
    setTogglingPrivacy(true)
    setError(null)
    try {
      await onSetPrivacy(request.id, !request.is_private)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update privacy.')
    } finally {
      setTogglingPrivacy(false)
    }
  }

  if (editing) {
    return (
      <article className="prayer-card">
        <div className="journal-editor">
          <input
            className="journal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you praying for?"
          />
          <textarea
            className="journal-body-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Details (optional)"
          />
          <select className="prayer-list-select" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Unlisted</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="journal-card-edit-actions">
            <button type="button" onClick={handleSaveEdit} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="journal-card-edit-cancel" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </article>
    )
  }

  if (viewMode === 'list' && !expanded) {
    return (
      <article className="prayer-card prayer-list-row-card">
        <PrivateGate
          isPrivate={request.is_private}
          pinConfigured={pinConfigured}
          verifyPin={verifyPin}
          placeholderMeta={
            <div className="journal-card-header">
              <div>
                <span className={`prayer-status-badge prayer-status-${request.status}`}>{STATUS_LABEL[request.status]}</span>
                <p className="journal-card-date">{date}</p>
              </div>
            </div>
          }
        >
          <div
            className="prayer-list-row"
            role="button"
            tabIndex={0}
            onClick={() => setExpanded(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setExpanded(true)
              }
            }}
          >
            <input
              type="checkbox"
              className="prayer-list-checkbox"
              checked={markedToday}
              disabled={marking || markedToday}
              title={markedToday ? 'Prayed for this today' : 'I prayed for this today'}
              onClick={(e) => e.stopPropagation()}
              onChange={handleMarkPrayed}
            />
            <span className={`prayer-status-badge prayer-status-${request.status}`}>{STATUS_LABEL[request.status]}</span>
            <span className="prayer-list-row-title">{request.title}</span>
            <span className="prayer-list-row-whisper">
              {marks.length === 0 ? 'Not marked yet' : `Last prayed ${formatRelative(marks[0].created_at)}`}
            </span>
            <span className="prayer-list-row-chevron" aria-hidden="true">
              ▾
            </span>
          </div>
          {error && <p className="error">{error}</p>}
        </PrivateGate>
      </article>
    )
  }

  return (
    <article className="prayer-card">
      <PrivateGate
        isPrivate={request.is_private}
        pinConfigured={pinConfigured}
        verifyPin={verifyPin}
        placeholderMeta={
          <div className="journal-card-header">
            <div>
              <span className={`prayer-status-badge prayer-status-${request.status}`}>{STATUS_LABEL[request.status]}</span>
              <p className="journal-card-date">{date}</p>
            </div>
          </div>
        }
      >
        <div className="journal-card-header">
          <div>
            <span className={`prayer-status-badge prayer-status-${request.status}`}>{STATUS_LABEL[request.status]}</span>
            <h2>{request.title}</h2>
            <p className="journal-card-date">{date}</p>
          </div>
          <div className="journal-card-actions">
            <button type="button" className="journal-card-privacy" onClick={handleTogglePrivacy} disabled={togglingPrivacy}>
              {request.is_private ? 'Make Public' : 'Make Private'}
            </button>
            <button type="button" className="journal-card-edit" onClick={startEdit}>
              Edit
            </button>
            <button type="button" className="journal-card-delete" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>

        {request.description && <p className="entry-body">{request.description}</p>}

        <div className="prayer-mark-row">
          <button type="button" className="prayer-mark-button" onClick={handleMarkPrayed} disabled={marking}>
            {marking ? 'Marking…' : 'I prayed for this'}
          </button>
          <span className="prayer-mark-whisper">
            {marks.length === 0 ? 'Not marked yet' : `Last prayed ${formatRelative(marks[0].created_at)}`}
          </span>
          {marks.length > 0 && (
            <span className="prayer-mark-strip" aria-hidden="true">
              {[...marks]
                .slice(0, 20)
                .reverse()
                .map((m) => (
                  <span key={m.id} className="prayer-mark-dot" title={new Date(m.created_at).toLocaleString()} />
                ))}
            </span>
          )}
        </div>

        {request.status === 'answered' && request.answered_note && (
          <div className="prayer-answered-note">
            <h3>Answered</h3>
            <p>{request.answered_note}</p>
          </div>
        )}

        {answering ? (
          <div className="prayer-answer-form">
            <textarea
              value={answerNote}
              onChange={(e) => setAnswerNote(e.target.value)}
              rows={3}
              placeholder="How was this answered? (optional)"
            />
            <div className="journal-card-edit-actions">
              <button type="button" onClick={handleConfirmAnswered} disabled={busy}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
              <button type="button" className="journal-card-edit-cancel" onClick={() => setAnswering(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="prayer-status-actions">
            {request.status !== 'active' && request.status !== 'answered' && (
              <button type="button" onClick={() => handleSetStatus('active')} disabled={busy}>
                Mark active
              </button>
            )}
            {request.status !== 'ongoing' && request.status !== 'answered' && (
              <button type="button" onClick={() => handleSetStatus('ongoing')} disabled={busy}>
                Mark ongoing
              </button>
            )}
            {request.status === 'answered' && (
              <button type="button" onClick={() => handleSetStatus('active')} disabled={busy}>
                Reopen
              </button>
            )}
            {request.status !== 'answered' && (
              <button type="button" onClick={() => setAnswering(true)} disabled={busy}>
                Mark answered
              </button>
            )}
            {request.status !== 'archived' && (
              <button type="button" onClick={() => handleSetStatus('archived')} disabled={busy}>
                Archive
              </button>
            )}
            {request.status === 'archived' && (
              <button type="button" onClick={() => handleSetStatus('active')} disabled={busy}>
                Restore
              </button>
            )}
          </div>
        )}

        <button type="button" className="anchor-scripture-toggle" onClick={() => setHistoryOpen((o) => !o)}>
          {historyOpen ? '▲ Hide journey' : '▾ Show journey'}
        </button>
        {historyOpen && <PrayerRequestHistory requestId={request.id} pinConfigured={pinConfigured} verifyPin={verifyPin} />}

        <button type="button" className="anchor-scripture-toggle" onClick={handleToggleGrounding}>
          {groundingOpen ? '▲ Hide related Scripture' : '▾ Related Scripture'}
        </button>
        {groundingOpen && (
          <>
            {groundingLoading && <p className="placeholder">Searching Nave's Topical Bible…</p>}
            {groundingError && <p className="error">Couldn't load related Scripture: {groundingError}</p>}
            {!groundingLoading && !groundingError && groundingGroups && <PrayerGrounding groups={groundingGroups} />}
          </>
        )}

        {viewMode === 'list' && (
          <button type="button" className="anchor-scripture-toggle" onClick={() => setExpanded(false)}>
            ▲ Collapse
          </button>
        )}

        {error && <p className="error">{error}</p>}
      </PrivateGate>
    </article>
  )
}
