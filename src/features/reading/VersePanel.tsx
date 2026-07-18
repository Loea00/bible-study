import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entry } from '../../types/db'
import type { JournalExcerpt } from './useJournalExcerpts'

interface VersePanelProps {
  verseText: string
  reference: string
  notes: Entry[]
  journalExcerpts: JournalExcerpt[]
  onDeleteNote: (entryId: string) => Promise<void>
  onClose: () => void
}

// View + delete only — creating notes now happens via text selection (spec
// amendment v1.1 §A9), not from this panel. This panel is what opens when
// tapping an *existing* note-dot or journal-dot. Highlights have their own
// dedicated HighlightGroupPanel (a highlight can be a non-consecutive,
// multi-verse group — this panel is deliberately single-verse-scoped and
// can't represent that). Renders as plain content inside ReadingView's
// docked side panel — no overlay/backdrop of its own.
export function VersePanel({ verseText, reference, notes, journalExcerpts, onDeleteNote, onClose }: VersePanelProps) {
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteNote(entryId: string) {
    setDeletingNoteId(entryId)
    setDeleteError(null)
    try {
      await onDeleteNote(entryId)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the note.')
    } finally {
      setDeletingNoteId(null)
    }
  }

  return (
    <div className="side-panel-body">
      <div className="verse-panel-header">
        <h2>{reference}</h2>
        <button type="button" className="picker-back" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="verse-panel-text">{verseText}</p>

      {notes.length > 0 && (
        <div className="verse-panel-section">
          <h3>Margin notes</h3>
          <div className="verse-panel-notes">
            {notes.map((note) => (
              <div key={note.id} className="verse-panel-note">
                <p>{note.body}</p>
                <button
                  type="button"
                  className="verse-panel-note-delete"
                  onClick={() => handleDeleteNote(note.id)}
                  disabled={deletingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            ))}
            {deleteError && <p className="error">{deleteError}</p>}
          </div>
        </div>
      )}

      {journalExcerpts.length > 0 && (
        <div className="verse-panel-section">
          <h3>Journal</h3>
          <div className="verse-panel-excerpts">
            {journalExcerpts.map((ex) => (
              <div key={ex.entryId} className="verse-panel-excerpt">
                <div className="verse-panel-excerpt-header">
                  {ex.title && <span className="verse-panel-excerpt-title">{ex.title}</span>}
                  <span className="verse-panel-excerpt-date">
                    {new Date(ex.date).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="verse-panel-excerpt-text">{ex.excerpt}</p>
                <Link to={`/journal?entry=${ex.entryId}`} className="verse-panel-excerpt-link">
                  Open full entry →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 && journalExcerpts.length === 0 && (
        <p className="placeholder">Nothing connected to this verse yet.</p>
      )}
    </div>
  )
}
