import { useState, type FormEvent } from 'react'
import type { Entry, HighlightColor } from '../../types/db'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

interface VersePanelProps {
  verseId: string
  verseText: string
  reference: string
  notes: Entry[]
  highlightColor: HighlightColor | null
  onAddNote: (body: string) => Promise<void>
  onSetHighlight: (color: HighlightColor | null) => Promise<void>
  onClose: () => void
}

export function VersePanel({
  verseText,
  reference,
  notes,
  highlightColor,
  onAddNote,
  onSetHighlight,
  onClose,
}: VersePanelProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightError, setHighlightError] = useState<string | null>(null)

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

  async function handleHighlight(color: HighlightColor) {
    setHighlightError(null)
    try {
      await onSetHighlight(highlightColor === color ? null : color)
    } catch (err) {
      setHighlightError(err instanceof Error ? err.message : 'Could not save the highlight.')
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

        <div className="highlight-swatches">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`highlight-swatch highlight-swatch-${color}${highlightColor === color ? ' active' : ''}`}
              aria-label={`Highlight ${color}`}
              onClick={() => handleHighlight(color)}
            />
          ))}
        </div>
        {highlightError && <p className="error">{highlightError}</p>}

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
