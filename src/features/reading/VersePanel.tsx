import { useState, type FormEvent } from 'react'
import type { Entry } from '../../types/db'

interface VersePanelProps {
  verseId: string
  verseText: string
  reference: string
  notes: Entry[]
  onAddNote: (body: string) => Promise<void>
  onClose: () => void
}

export function VersePanel({ verseText, reference, notes, onAddNote, onClose }: VersePanelProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onAddNote(draft.trim())
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the note.')
    } finally {
      setSaving(false)
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

        {notes.length > 0 && (
          <div className="verse-panel-notes">
            {notes.map((note) => (
              <p key={note.id} className="verse-panel-note">
                {note.body}
              </p>
            ))}
          </div>
        )}

        <form className="verse-panel-form" onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            rows={3}
          />
          <button type="submit" disabled={saving || !draft.trim()}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
