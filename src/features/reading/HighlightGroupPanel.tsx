import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatReference } from './books'
import type { Highlight } from '../../types/db'

interface HighlightGroupPanelProps {
  highlight: Highlight
  translation: string
  onExtend: () => void
  onNote: () => void
  onRemove: () => Promise<void>
  onClose: () => void
}

// Opens the *whole* highlight group — every span, in the order they were
// selected, even non-consecutive ones spanning multiple verses — rather
// than the single verse that happened to be tapped. Fetches its own verse
// text directly (not from ReadingView's currently-loaded chapter) since a
// group's spans can reach outside the chapter currently on screen.
export function HighlightGroupPanel({ highlight, translation, onExtend, onNote, onRemove, onClose }: HighlightGroupPanelProps) {
  const [textByVerse, setTextByVerse] = useState<Record<string, string> | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verseIdsKey = highlight.spans.map((s) => s.verse_id).join(',')

  useEffect(() => {
    let cancelled = false
    setTextByVerse(null)
    const verseIds = [...new Set(verseIdsKey.split(','))]

    supabase
      .from('verses')
      .select('verse_id, text')
      .in('verse_id', verseIds)
      .eq('translation_code', translation)
      .then(({ data }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const v of (data ?? []) as { verse_id: string; text: string }[]) {
          map[v.verse_id] = v.text
        }
        setTextByVerse(map)
      })

    return () => {
      cancelled = true
    }
  }, [verseIdsKey, translation])

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the highlight.')
      setRemoving(false)
    }
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="verse-panel" onClick={(e) => e.stopPropagation()}>
        <div className="verse-panel-header">
          <h2>Highlight</h2>
          <button type="button" className="picker-back" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="highlight-group-header">
          <span className={`highlight-swatch highlight-swatch-${highlight.color}`} aria-hidden="true" />
          <span className="highlight-group-count">
            {highlight.spans.length} part{highlight.spans.length === 1 ? '' : 's'}
          </span>
        </div>

        {textByVerse === null && <p className="placeholder">Loading…</p>}
        {textByVerse && (
          <div className="highlight-group-pieces">
            {highlight.spans.map((s, i) => {
              const full = textByVerse[s.verse_id]
              const piece = full != null ? full.slice(s.start_offset ?? 0, s.end_offset ?? full.length) : null
              return (
                <div key={`${s.verse_id}-${i}`} className="highlight-group-piece">
                  <span className="highlight-group-ref">{formatReference(s.verse_id)}</span>
                  <p className="highlight-group-text">{piece ?? '(text unavailable)'}</p>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="highlight-group-actions">
          <button type="button" className="selection-bar-action" onClick={onExtend}>
            Extend
          </button>
          <button type="button" className="selection-bar-action" onClick={onNote}>
            Note
          </button>
          <button type="button" className="verse-panel-note-delete" disabled={removing} onClick={handleRemove}>
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}
