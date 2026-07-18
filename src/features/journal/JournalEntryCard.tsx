import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entry } from '../../types/db'
import { EntryBody } from './EntryBody'
import { AnchorScripture } from '../reading/AnchorScripture'
import { parseVerseId, formatReference } from '../reading/books'

interface JournalEntryCardProps {
  entry: Entry
  onEdit: (entryId: string, title: string, body: string, tags: string[]) => Promise<unknown>
  onDelete: (entryId: string) => Promise<void>
}

// A reflection's anchor can span multiple, non-consecutive verses (like a
// highlight group) — entries.anchor_start/anchor_end only capture the
// first/last, so this is a summary range, not necessarily every piece.
// Still better than the "no scriptural information at all" it showed
// before, and matches what's cheaply available without an extra
// verse_references fetch per card in a list.
function formatAnchorRange(anchorStart: string, anchorEnd: string): string {
  return anchorStart === anchorEnd
    ? formatReference(anchorStart)
    : `${formatReference(anchorStart)} – ${formatReference(anchorEnd)}`
}

export function JournalEntryCard({ entry, onEdit, onDelete }: JournalEntryCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title ?? '')
  const [body, setBody] = useState(entry.body)
  const [tagsInput, setTagsInput] = useState(entry.tags.join(', '))
  const [saving, setSaving] = useState(false)

  const date = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

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

  function startEdit() {
    setTitle(entry.title ?? '')
    setBody(entry.body)
    setTagsInput(entry.tags.join(', '))
    setError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await onEdit(entry.id, title, body, tags)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the changes.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <article className="journal-card">
        <div className="journal-editor">
          <input
            className="journal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
          />
          <textarea
            className="journal-body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
          />
          <input
            className="journal-tags-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Topical tags, comma separated (optional)"
          />
          <div className="journal-card-edit-actions">
            <button type="button" onClick={handleSaveEdit} disabled={saving || !body.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="journal-card-edit-cancel"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </article>
    )
  }

  return (
    <article className="journal-card">
      <div className="journal-card-header">
        <div>
          {entry.entry_type === 'reflection' && <span className="journal-card-badge">Reflection</span>}
          {entry.title && <h2>{entry.title}</h2>}
          <p className="journal-card-date">{date}</p>
          {entry.entry_type === 'reflection' && entry.anchor_start && entry.anchor_end && (
            <Link
              to={`/?book=${parseVerseId(entry.anchor_start).book}&chapter=${parseVerseId(entry.anchor_start).chapter}`}
              className="journal-card-reference"
            >
              {formatAnchorRange(entry.anchor_start, entry.anchor_end)}
            </Link>
          )}
        </div>
        <div className="journal-card-actions">
          <button type="button" className="journal-card-edit" onClick={startEdit}>
            Edit
          </button>
          <button type="button" className="journal-card-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      {entry.entry_type === 'reflection' && <AnchorScripture entryId={entry.id} />}
      <EntryBody text={entry.body} />
      {entry.tags.length > 0 && (
        <div className="journal-card-tags">
          {entry.tags.map((tag) => (
            <span key={tag} className="journal-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  )
}
