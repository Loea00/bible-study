import { useState } from 'react'
import type { Entry } from '../../types/db'
import { EntryBody } from './EntryBody'

interface JournalEntryCardProps {
  entry: Entry
  onDelete: (entryId: string) => Promise<void>
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <article className="journal-card">
      <div className="journal-card-header">
        <div>
          {entry.title && <h2>{entry.title}</h2>}
          <p className="journal-card-date">{date}</p>
        </div>
        <button type="button" className="journal-card-delete" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
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
