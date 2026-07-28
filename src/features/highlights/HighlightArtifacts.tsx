import { useState } from 'react'
import type { Entry } from '../../types/db'
import { useHighlightArtifacts } from './useHighlightArtifacts'
import { EntryBody } from '../journal/EntryBody'

interface HighlightArtifactEntryProps {
  entry: Entry
  onEdit: (entryId: string, title: string, body: string) => Promise<unknown>
  onDelete: (entryId: string) => Promise<void>
}

function HighlightArtifactEntry({ entry, onEdit, onDelete }: HighlightArtifactEntryProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title ?? '')
  const [body, setBody] = useState(entry.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const date = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  function startEdit() {
    setTitle(entry.title ?? '')
    setBody(entry.body)
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onEdit(entry.id, title, body)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this.')
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="highlight-artifact-entry-edit">
        <input
          className="journal-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
        />
        <textarea className="journal-body-input" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        <div className="journal-card-edit-actions">
          <button type="button" onClick={handleSave} disabled={saving || !body.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="journal-card-edit-cancel" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="highlight-artifact-entry">
      <div className="highlight-artifact-entry-header">
        <span className="highlight-artifact-entry-date">{date}</span>
        <div className="highlight-artifact-entry-actions">
          <button type="button" className="verse-panel-note-edit-btn" onClick={startEdit}>
            Edit
          </button>
          <button type="button" className="verse-panel-note-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      {entry.title && <p className="highlight-artifact-entry-title">{entry.title}</p>}
      <EntryBody text={entry.body} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

interface HighlightArtifactsProps {
  highlightId: string
}

// Rendered only while a highlight's "Show artifacts" toggle is open — the
// hook's fetch-on-mount doubles as lazy loading, same effect as
// PrayerRequestHistory's toggle-gated fetch.
export function HighlightArtifacts({ highlightId }: HighlightArtifactsProps) {
  const { entries, loading, addEntry, updateEntry, deleteEntry } = useHighlightArtifacts(highlightId)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addEntry(title, body)
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="highlight-artifacts">
      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && <p className="placeholder">Nothing written yet.</p>}

      <div className="highlight-artifacts-list">
        {entries.map((entry) => (
          <HighlightArtifactEntry key={entry.id} entry={entry} onEdit={updateEntry} onDelete={deleteEntry} />
        ))}
      </div>

      <div className="highlight-artifacts-composer">
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
          rows={3}
          placeholder="Write something about this highlight…"
        />
        <button type="button" onClick={handleSave} disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : 'Add artifact'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
