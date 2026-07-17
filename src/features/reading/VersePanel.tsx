import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entry, HighlightColor } from '../../types/db'
import type { JournalExcerpt } from './useJournalExcerpts'

interface PanelHighlight {
  id: string
  color: HighlightColor
}

interface VersePanelProps {
  verseText: string
  reference: string
  notes: Entry[]
  journalExcerpts: JournalExcerpt[]
  highlights: PanelHighlight[]
  onDeleteNote: (entryId: string) => Promise<void>
  onRemoveHighlight: (highlightId: string) => Promise<void>
  onClose: () => void
}

// View + delete only — creating notes/highlights now happens via text
// selection (spec amendment v1.1 §A9), not from this panel. This panel is
// what opens when tapping an *existing* mark: a note-dot, a journal-dot, or
// a highlighted span.
export function VersePanel({
  verseText,
  reference,
  notes,
  journalExcerpts,
  highlights,
  onDeleteNote,
  onRemoveHighlight,
  onClose,
}: VersePanelProps) {
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [removingHighlightId, setRemovingHighlightId] = useState<string | null>(null)
  const [highlightError, setHighlightError] = useState<string | null>(null)

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

  async function handleRemoveHighlight(highlightId: string) {
    setRemovingHighlightId(highlightId)
    setHighlightError(null)
    try {
      await onRemoveHighlight(highlightId)
    } catch (err) {
      setHighlightError(err instanceof Error ? err.message : 'Could not remove the highlight.')
    } finally {
      setRemovingHighlightId(null)
    }
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="verse-panel" onClick={(e) => e.stopPropagation()}>
        <div className="verse-panel-header">
          <h2>{reference}</h2>
          <button type="button" className="picker-back" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="verse-panel-text">{verseText}</p>

        {highlights.length > 0 && (
          <div className="highlight-row">
            <div className="highlight-swatches">
              {highlights.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`highlight-swatch highlight-swatch-${h.color}`}
                  aria-label={`Remove ${h.color} highlight`}
                  disabled={removingHighlightId === h.id}
                  onClick={() => handleRemoveHighlight(h.id)}
                />
              ))}
            </div>
            <span className="highlight-row-hint">tap to remove</span>
          </div>
        )}
        {highlightError && <p className="error">{highlightError}</p>}

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

        {highlights.length === 0 && notes.length === 0 && journalExcerpts.length === 0 && (
          <p className="placeholder">Nothing connected to this verse yet.</p>
        )}
      </div>
    </div>
  )
}
