import { useState, type FormEvent } from 'react'

interface NoteComposerProps {
  onSave: (body: string) => Promise<void>
  onClose: () => void
}

export function NoteComposer({ onSave, onClose }: NoteComposerProps) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(body.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the note.')
      setSaving(false)
    }
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="verse-panel" onClick={(e) => e.stopPropagation()}>
        <div className="verse-panel-header">
          <h2>Add a note</h2>
          <button type="button" className="picker-back" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="verse-panel-form" onSubmit={handleSubmit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note…"
            rows={4}
            autoFocus
          />
          <button type="submit" disabled={saving || !body.trim()}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
