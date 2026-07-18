import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entry } from '../../types/db'
import { EntryBody } from './EntryBody'
import { parseVerseId, formatReference } from '../reading/books'

interface JournalEntryCardProps {
  entry: Entry
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
