import { useState, type FormEvent } from 'react'

interface ReflectionComposerProps {
  passageLabel: string
  onSave: (title: string, body: string) => Promise<unknown>
  onClose: () => void
}

// Renders inside ReadingView's docked side panel (spec §5.3: "Text slides
// aside; a writing page opens beside it. The passage stays pinned and
// readable while writing."). Anchoring is automatic from whatever spans
// this was opened with — no manual tagging UI, per spec. Inline @verse
// tags to *other* passages still work via the same parseVerseTags
// mechanism the journal editor uses; no live preview needed here either,
// matching that existing precedent.
export function ReflectionComposer({ passageLabel, onSave, onClose }: ReflectionComposerProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(title, body)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the reflection.')
      setSaving(false)
    }
  }

  return (
    <div className="side-panel-body">
      <div className="verse-panel-header">
        <h2>Reflecting on {passageLabel}</h2>
        <button type="button" className="picker-back" onClick={onClose}>
          Close
        </button>
      </div>
      <form className="journal-editor" onSubmit={handleSubmit}>
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
          placeholder="Write freely. Tag a verse anywhere with @Book chapter:verse — e.g. @Psa 46:10."
          rows={10}
          autoFocus
        />
        <button type="submit" disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : 'Save reflection'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
