import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAllHighlights } from './useAllHighlights'
import { parseVerseId, formatReference } from '../reading/books'
import type { Highlight } from '../../types/db'

interface HighlightListItemProps {
  highlight: Highlight
  textByKey: Record<string, string>
  onRemove: (highlightId: string) => Promise<void>
}

function HighlightListItem({ highlight, textByKey, onRemove }: HighlightListItemProps) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const translation = highlight.translation ?? 'KJV'
  const first = highlight.spans[0]

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove(highlight.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the highlight.')
      setRemoving(false)
    }
  }

  return (
    <div className="highlight-list-item">
      <div className="highlight-group-header">
        <span className={`highlight-swatch highlight-swatch-${highlight.color}`} aria-hidden="true" />
        <span className="highlight-group-count">
          {highlight.spans.length} part{highlight.spans.length === 1 ? '' : 's'}
        </span>
        <Link
          to={`/?book=${parseVerseId(first.verse_id).book}&chapter=${parseVerseId(first.verse_id).chapter}`}
          className="highlight-list-open"
        >
          Open in reading view →
        </Link>
      </div>

      <div className="highlight-group-pieces">
        {highlight.spans.map((s, i) => {
          const full = textByKey[`${translation}:${s.verse_id}`]
          const piece = full != null ? full.slice(s.start_offset ?? 0, s.end_offset ?? full.length) : null
          return (
            <div key={`${s.verse_id}-${i}`} className="highlight-group-piece">
              <span className="highlight-group-ref">{formatReference(s.verse_id)}</span>
              <p className="highlight-group-text">{piece ?? 'Loading…'}</p>
            </div>
          )
        })}
      </div>

      <button type="button" className="verse-panel-note-delete" disabled={removing} onClick={handleRemove}>
        {removing ? 'Removing…' : 'Remove'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export function HighlightsPage() {
  const { highlights, loading, textByKey, removeHighlight } = useAllHighlights()

  return (
    <div className="highlights-page">
      {!loading && (
        <p className="highlights-count">
          {highlights.length} highlight{highlights.length === 1 ? '' : 's'}
        </p>
      )}
      {loading && <p className="placeholder">Loading…</p>}
      {!loading && highlights.length === 0 && (
        <p className="placeholder">No highlights yet — select text in the reading view to mark one.</p>
      )}

      <div className="highlights-list">
        {highlights.map((h) => (
          <HighlightListItem key={h.id} highlight={h} textByKey={textByKey} onRemove={removeHighlight} />
        ))}
      </div>
    </div>
  )
}
