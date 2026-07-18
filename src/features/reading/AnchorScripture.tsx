import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatReference, compareVerseIds } from './books'

interface ScripturePiece {
  key: string
  verseId: string
  text: string
}

interface AnchorScriptureProps {
  entryId: string
}

// Shows the actual quoted scripture a note/reflection is anchored to — every
// span, not just one verse, since an entry can anchor across several
// non-consecutive parts (spec amendment v1.1 §A9's "+Add" groups apply to
// notes/reflections too, not just highlights). Collapsed and unfetched by
// default; fetches on first expand only, then caches for the rest of this
// component's lifetime. Shared between JournalEntryCard (reflections) and
// VersePanel (notes + reflections), since both had the same gap: showing
// only the one verse whose dot/card happened to be clicked, not the whole
// anchored group — the same "sum of the parts" problem HighlightGroupPanel
// already solved for highlights, reused here via the same verse_references
// query shape.
export function AnchorScripture({ entryId }: AnchorScriptureProps) {
  const [expanded, setExpanded] = useState(false)
  const [pieces, setPieces] = useState<ScripturePiece[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (!next || pieces !== null) return

    setError(null)
    const { data: refs, error: refError } = await supabase
      .from('verse_references')
      .select('*')
      .eq('entry_id', entryId)
      .eq('ref_kind', 'anchor')

    if (refError) {
      setError('Could not load the scripture.')
      return
    }
    if (!refs || refs.length === 0) {
      setPieces([])
      return
    }

    const sorted = [...refs].sort(
      (a, b) => compareVerseIds(a.verse_start, b.verse_start) || (a.start_offset ?? 0) - (b.start_offset ?? 0),
    )
    const translation = sorted[0].translation ?? 'KJV'
    const verseIds = [...new Set(sorted.map((r) => r.verse_start))]

    const { data: verses } = await supabase
      .from('verses')
      .select('verse_id, text')
      .in('verse_id', verseIds)
      .eq('translation_code', translation)
    const textByVerse = new Map((verses ?? []).map((v) => [v.verse_id, v.text]))

    setPieces(
      sorted.map((r, i) => {
        const full = textByVerse.get(r.verse_start)
        const text = full != null ? full.slice(r.start_offset ?? 0, r.end_offset ?? full.length) : '(text unavailable)'
        return { key: `${r.verse_start}-${i}`, verseId: r.verse_start, text }
      }),
    )
  }

  return (
    <div className="anchor-scripture">
      <button type="button" className="anchor-scripture-toggle" onClick={handleToggle}>
        {expanded ? 'Hide scripture ▲' : 'Show scripture ▾'}
      </button>
      {expanded && (
        <div className="highlight-group-pieces">
          {pieces === null && !error && <p className="placeholder">Loading…</p>}
          {error && <p className="error">{error}</p>}
          {pieces?.map((p) => (
            <div key={p.key} className="highlight-group-piece">
              <span className="highlight-group-ref">{formatReference(p.verseId)}</span>
              <p className="highlight-group-text">{p.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
