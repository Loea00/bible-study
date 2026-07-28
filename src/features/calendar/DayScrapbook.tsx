import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entry } from '../../types/db'
import { useCalendarDay } from './useCalendarDay'
import { EntryBody } from '../journal/EntryBody'
import { AnchorScripture } from '../reading/AnchorScripture'
import { formatReferenceRange, parseVerseId } from '../reading/books'

const PRAYER_ENTRY_LABEL: Partial<Record<Entry['entry_type'], string>> = {
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
  vision: 'Vision',
}

// A "diary page" rendering of one entry -- reuses the same
// .journal-card/EntryBody/AnchorScripture markup JournalEntryCard.tsx
// already established. Editing still stays on Journal/Prayer, but a
// straight delete is exposed here so a day's page can be cleaned up
// without leaving the calendar.
function DayEntryCard({ entry, onDelete }: { entry: Entry; onDelete: (entryId: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the entry.')
      setDeleting(false)
    }
  }

  return (
    <article className="journal-card">
      <div className="journal-card-header">
        <div>
          {entry.entry_type === 'reflection' && <span className="journal-card-badge">Reflection</span>}
          {entry.entry_type === 'margin_note' && <span className="journal-card-badge">Margin note</span>}
          {PRAYER_ENTRY_LABEL[entry.entry_type] && (
            <span className="journal-card-badge">{PRAYER_ENTRY_LABEL[entry.entry_type]}</span>
          )}
          {entry.title && <h2>{entry.title}</h2>}
          {(entry.entry_type === 'reflection' || entry.entry_type === 'margin_note') &&
            entry.anchor_start &&
            entry.anchor_end && (
              <Link
                to={`/?book=${parseVerseId(entry.anchor_start).book}&chapter=${parseVerseId(entry.anchor_start).chapter}`}
                className="journal-card-reference"
              >
                {formatReferenceRange(entry.anchor_start, entry.anchor_end)}
              </Link>
            )}
        </div>
        <div className="journal-card-actions">
          <button type="button" className="journal-card-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      {entry.entry_type === 'reflection' && <AnchorScripture entryId={entry.id} />}
      <EntryBody text={entry.body} />
      {error && <p className="error">{error}</p>}
    </article>
  )
}

interface DayScrapbookProps {
  date: Date
}

export function DayScrapbook({ date }: DayScrapbookProps) {
  const { sessions, entries, answeredPrayers, loading, deleteSession, deleteEntry, unmarkAnswered } =
    useCalendarDay(date)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const heading = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const isEmpty = !loading && sessions.length === 0 && entries.length === 0 && answeredPrayers.length === 0

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm('Delete this reading session? Notes and journal entries written during it are kept, just unlinked from it.')) return
    setBusyId(sessionId)
    setError(null)
    try {
      await deleteSession(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the session.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnmarkAnswered(requestId: string) {
    setBusyId(requestId)
    setError(null)
    try {
      await unmarkAnswered(requestId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="calendar-day-scrapbook">
      <h1 className="calendar-day-heading">{heading}</h1>

      {loading && <p className="placeholder">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {isEmpty && <p className="placeholder">No entries on this day yet.</p>}

      {sessions.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Reading</h3>
          {sessions.map((session) => (
            <div key={session.id} className="calendar-line-item">
              <span className="calendar-session-block">
                {session.passage_start && session.passage_end
                  ? formatReferenceRange(session.passage_start, session.passage_end)
                  : session.passage_start
                    ? parseVerseId(session.passage_start).book
                    : 'A reading session'}
              </span>
              <button
                type="button"
                className="calendar-line-delete"
                onClick={() => handleDeleteSession(session.id)}
                disabled={busyId === session.id}
              >
                {busyId === session.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Notes &amp; Reflections</h3>
          <div className="journal-timeline">
            {entries.map((entry) => (
              <DayEntryCard key={entry.id} entry={entry} onDelete={deleteEntry} />
            ))}
          </div>
        </div>
      )}

      {answeredPrayers.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Prayer</h3>
          {answeredPrayers.map((request) => (
            <div key={request.id} className="calendar-line-item">
              <Link to="/prayer" className="calendar-answered-badge">
                Answered: {request.title}
              </Link>
              <button
                type="button"
                className="calendar-line-delete"
                onClick={() => handleUnmarkAnswered(request.id)}
                disabled={busyId === request.id}
              >
                {busyId === request.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
