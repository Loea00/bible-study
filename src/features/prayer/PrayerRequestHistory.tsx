import { useState } from 'react'
import type { Entry } from '../../types/db'
import { usePrayerEntries, type PrayerEntryType } from './usePrayerEntries'
import { EntryBody } from '../journal/EntryBody'

const KIND_LABEL: Record<PrayerEntryType, string> = {
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
}

const KIND_OPTIONS: { value: PrayerEntryType; label: string }[] = [
  { value: 'prayer_update', label: 'Update' },
  { value: 'word', label: 'Word' },
  { value: 'concern', label: 'Concern' },
]

interface PrayerHistoryEntryProps {
  entry: Entry
  onEdit: (entryId: string, entryType: PrayerEntryType, title: string, body: string) => Promise<unknown>
  onDelete: (entryId: string) => Promise<void>
}

function PrayerHistoryEntry({ entry, onEdit, onDelete }: PrayerHistoryEntryProps) {
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<PrayerEntryType>(entry.entry_type as PrayerEntryType)
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
    setKind(entry.entry_type as PrayerEntryType)
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
      await onEdit(entry.id, kind, title, body)
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
      <div className="prayer-history-entry-edit">
        <select className="prayer-list-select" value={kind} onChange={(e) => setKind(e.target.value as PrayerEntryType)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
    <div className="prayer-history-entry">
      <div className="prayer-history-entry-header">
        <span className={`prayer-history-entry-kind prayer-history-kind-${entry.entry_type}`}>
          {KIND_LABEL[entry.entry_type as PrayerEntryType]}
        </span>
        <span className="prayer-history-entry-date">{date}</span>
        <div className="prayer-history-entry-actions">
          <button type="button" className="verse-panel-note-edit-btn" onClick={startEdit}>
            Edit
          </button>
          <button type="button" className="verse-panel-note-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
      {entry.title && <p className="prayer-history-entry-title">{entry.title}</p>}
      <EntryBody text={entry.body} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

interface PrayerRequestHistoryProps {
  requestId: string
}

// Rendered only while the card's "Show history" toggle is open — the
// hook's fetch-on-mount doubles as lazy loading, same effect as
// AnchorScripture's explicit lazy-fetch-on-first-expand.
export function PrayerRequestHistory({ requestId }: PrayerRequestHistoryProps) {
  const { entries, loading, addEntry, updateEntry, deleteEntry } = usePrayerEntries(requestId)

  const [kind, setKind] = useState<PrayerEntryType>('prayer_update')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addEntry(kind, title, body)
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="prayer-history">
      <div className="prayer-history-composer">
        <select className="prayer-list-select" value={kind} onChange={(e) => setKind(e.target.value as PrayerEntryType)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
          placeholder="What are you noticing, sensing, or working through?"
        />
        <button type="button" onClick={handleSave} disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : 'Add to history'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && <p className="placeholder">Nothing recorded yet.</p>}

      <div className="prayer-history-list">
        {entries.map((entry) => (
          <PrayerHistoryEntry key={entry.id} entry={entry} onEdit={updateEntry} onDelete={deleteEntry} />
        ))}
      </div>
    </div>
  )
}
