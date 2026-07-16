import { useState, type FormEvent } from 'react'

interface JournalEditorProps {
  onSave: (title: string, body: string, tags: string[]) => Promise<unknown>
}

export function JournalEditor({ onSave }: JournalEditorProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      await onSave(title, body, tags)
      setTitle('')
      setBody('')
      setTagsInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
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
        rows={8}
      />
      <input
        className="journal-tags-input"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Topical tags, comma separated (optional)"
      />
      <button type="submit" disabled={saving || !body.trim()}>
        {saving ? 'Saving…' : 'Save entry'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
