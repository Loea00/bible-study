import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { parseVerseId, formatReference, compareVerseIds } from './books'

interface Occurrence {
  verse_id: string
  tag_text: string
}

interface ConcordanceViewProps {
  strongsId: string
  lemma: string
  onClose: () => void
}

export function ConcordanceView({ strongsId, lemma, onClose }: ConcordanceViewProps) {
  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setOccurrences(null)
    setError(null)

    supabase
      .rpc('verses_for_strongs', { target_id: strongsId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          return
        }
        const rows = (data ?? []) as Occurrence[]
        rows.sort((a, b) => compareVerseIds(a.verse_id, b.verse_id))
        setOccurrences(rows)
      })

    return () => {
      cancelled = true
    }
  }, [strongsId])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="verse-panel" onClick={(e) => e.stopPropagation()}>
        <div className="verse-panel-header">
          <h2>
            {lemma} · {strongsId}
          </h2>
          <button type="button" className="picker-back" onClick={onClose}>
            Close
          </button>
        </div>

        {occurrences === null && !error && <p className="placeholder">Loading…</p>}
        {error && <p className="placeholder">Couldn't load occurrences: {error}</p>}
        {occurrences && (
          <>
            <p className="concordance-count">
              {occurrences.length === 300
                ? 'First 300 occurrences'
                : `${occurrences.length} occurrence${occurrences.length === 1 ? '' : 's'}`}
            </p>
            <div className="concordance-list">
              {occurrences.map((o, i) => {
                const { book, chapter } = parseVerseId(o.verse_id)
                return (
                  <Link
                    key={`${o.verse_id}-${i}`}
                    to={`/?book=${book}&chapter=${chapter}`}
                    onClick={onClose}
                    className="concordance-item"
                  >
                    <span className="concordance-ref">{formatReference(o.verse_id)}</span>
                    <span className="concordance-text">{o.tag_text}</span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
