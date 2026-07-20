import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CommentaryEntry, Entry, EntryType, TskCrossReference } from '../../types/db'
import type { JournalExcerpt } from './useJournalExcerpts'
import type { ReflectionExcerpt } from './useReflections'
import { AnchorScripture } from './AnchorScripture'
import { formatReferenceRange, parseVerseId } from './books'

interface VersePanelProps {
  verseText: string
  reference: string
  notes: Entry[]
  journalExcerpts: JournalExcerpt[]
  reflections: ReflectionExcerpt[]
  crossReferences: TskCrossReference[]
  commentary: CommentaryEntry[]
  requestTitleById: Record<string, string>
  onEditNote: (entryId: string, body: string) => Promise<void>
  onDeleteNote: (entryId: string) => Promise<void>
  onClose: () => void
}

const PRAYER_KIND_LABEL: Partial<Record<EntryType, string>> = {
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
}

const COMMENTARY_SOURCE_LABEL: Record<string, string> = {
  MHCC: "Matthew Henry's Concise Commentary",
}

interface NoteItemProps {
  note: Entry
  onEdit: (entryId: string, body: string) => Promise<void>
  onDelete: (entryId: string) => Promise<void>
}

function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onEdit(note.id, body)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the note.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(note.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the note.')
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="verse-panel-note-wrap">
        <div className="verse-panel-note-edit">
          <textarea
            className="journal-body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="journal-card-edit-actions">
            <button type="button" onClick={handleSave} disabled={saving || !body.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="journal-card-edit-cancel"
              onClick={() => {
                setBody(note.body)
                setEditing(false)
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="verse-panel-note-wrap">
      <div className="verse-panel-note">
        <p>{note.body}</p>
        <div className="verse-panel-note-actions">
          <button type="button" className="verse-panel-note-edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="verse-panel-note-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      <AnchorScripture entryId={note.id} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

// View + delete/edit only — creating notes now happens via text selection
// (spec amendment v1.1 §A9), not from this panel. This panel is what opens
// when tapping an *existing* note-dot or journal-dot. Highlights have their
// own dedicated HighlightGroupPanel (a highlight can be a non-consecutive,
// multi-verse group — this panel is deliberately single-verse-scoped and
// can't represent that). Renders as plain content inside ReadingView's
// docked side panel — no overlay/backdrop of its own.
export function VersePanel({
  verseText,
  reference,
  notes,
  journalExcerpts,
  reflections,
  crossReferences,
  commentary,
  requestTitleById,
  onEditNote,
  onDeleteNote,
  onClose,
}: VersePanelProps) {
  const pureJournalExcerpts = journalExcerpts.filter((ex) => ex.entryType === 'journal')
  const prayerExcerpts = journalExcerpts.filter((ex) => ex.entryType !== 'journal')

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
              <NoteItem key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} />
            ))}
          </div>
        </div>
      )}

      {pureJournalExcerpts.length > 0 && (
        <div className="verse-panel-section">
          <h3>Journal</h3>
          <div className="verse-panel-excerpts">
            {pureJournalExcerpts.map((ex) => (
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

      {prayerExcerpts.length > 0 && (
        <div className="verse-panel-section">
          <h3>Prayer</h3>
          <div className="verse-panel-excerpts">
            {prayerExcerpts.map((ex) => (
              <div key={ex.entryId} className="verse-panel-excerpt">
                <div className="verse-panel-excerpt-header">
                  <span className="verse-panel-excerpt-title">
                    {PRAYER_KIND_LABEL[ex.entryType]}
                    {ex.title ? ` · ${ex.title}` : ''}
                  </span>
                  <span className="verse-panel-excerpt-date">
                    {new Date(ex.date).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="verse-panel-excerpt-text">{ex.excerpt}</p>
                {ex.requestId && requestTitleById[ex.requestId] && (
                  <Link to="/prayer" className="verse-panel-excerpt-link">
                    From: {requestTitleById[ex.requestId]} →
                  </Link>
                )}
                <Link to={`/journal?entry=${ex.entryId}`} className="verse-panel-excerpt-link">
                  Open full entry →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {reflections.length > 0 && (
        <div className="verse-panel-section">
          <h3>Reflections</h3>
          <div className="verse-panel-excerpts">
            {reflections.map((r) => (
              <div key={r.entryId} className="verse-panel-excerpt">
                <div className="verse-panel-excerpt-header">
                  {r.title && <span className="verse-panel-excerpt-title">{r.title}</span>}
                  <span className="verse-panel-excerpt-date">
                    {new Date(r.date).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="verse-panel-excerpt-text">{r.opening}</p>
                <Link to={`/journal?entry=${r.entryId}`} className="verse-panel-excerpt-link">
                  Open full entry →
                </Link>
                <AnchorScripture entryId={r.entryId} />
              </div>
            ))}
          </div>
        </div>
      )}

      {crossReferences.length > 0 && (
        <div className="verse-panel-section">
          <h3>Cross-references</h3>
          <ul className="verse-panel-refs">
            {crossReferences.map((ref) => {
              const target = parseVerseId(ref.to_verse_start)
              return (
                <li key={ref.id}>
                  <Link
                    to={`/?book=${target.book}&chapter=${target.chapter}&verse=${target.verse}`}
                    className="verse-panel-ref-link"
                  >
                    {formatReferenceRange(ref.to_verse_start, ref.to_verse_end)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {commentary.length > 0 && (
        <div className="verse-panel-section">
          <h3>Commentary</h3>
          <div className="verse-panel-excerpts">
            {commentary.map((c) => (
              <div key={c.id} className="verse-panel-excerpt">
                <div className="verse-panel-excerpt-header">
                  <span className="verse-panel-excerpt-title">{COMMENTARY_SOURCE_LABEL[c.source] ?? c.source}</span>
                  {c.verse_start !== c.verse_end && (
                    <span className="verse-panel-excerpt-date">{formatReferenceRange(c.verse_start, c.verse_end)}</span>
                  )}
                </div>
                <p className="verse-panel-excerpt-text">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 &&
        journalExcerpts.length === 0 &&
        reflections.length === 0 &&
        crossReferences.length === 0 &&
        commentary.length === 0 && <p className="placeholder">Nothing connected to this verse yet.</p>}
    </div>
  )
}
