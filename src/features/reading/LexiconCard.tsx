import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface LexiconEntry {
  strongs_id: string
  language: 'hebrew' | 'greek'
  lemma: string
  transliteration: string | null
  pronunciation: string | null
  derivation: string | null
  definition: string | null
  kjv_def: string | null
}

interface LexiconCardProps {
  strongsIds: string[]
  onClose: () => void
}

export function LexiconCard({ strongsIds, onClose }: LexiconCardProps) {
  const [entries, setEntries] = useState<LexiconEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    supabase
      .from('strongs_lexicon')
      .select('*')
      .in('strongs_id', strongsIds)
      .then(({ data }) => {
        if (cancelled) return
        const order = new Map(strongsIds.map((id, i) => [id, i]))
        const sorted = [...((data ?? []) as LexiconEntry[])].sort(
          (a, b) => (order.get(a.strongs_id) ?? 0) - (order.get(b.strongs_id) ?? 0),
        )
        setEntries(sorted)
      })
    return () => {
      cancelled = true
    }
  }, [strongsIds])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="lexicon-card" onClick={(e) => e.stopPropagation()}>
        <div className="verse-panel-header">
          <h2>{strongsIds.join(' + ')}</h2>
          <button type="button" className="picker-back" onClick={onClose}>
            Close
          </button>
        </div>

        {entries === null && <p className="placeholder">Loading…</p>}
        {entries?.length === 0 && <p className="placeholder">No lexicon entry found.</p>}

        {entries?.map((entry) => (
          <div key={entry.strongs_id} className="lexicon-entry">
            <div className="lexicon-entry-header">
              <span className="lexicon-lemma">{entry.lemma}</span>
              <span className="lexicon-id">{entry.strongs_id}</span>
            </div>
            {entry.transliteration && (
              <p className="lexicon-translit">
                {entry.transliteration}
                {entry.pronunciation ? ` (${entry.pronunciation})` : ''}
              </p>
            )}
            {entry.derivation && <p className="lexicon-derivation">{entry.derivation}</p>}
            {entry.definition && <p className="lexicon-definition">{entry.definition}</p>}
            {entry.kjv_def && (
              <p className="lexicon-kjv-def">
                <span className="lexicon-kjv-def-label">KJV renderings: </span>
                {entry.kjv_def}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
