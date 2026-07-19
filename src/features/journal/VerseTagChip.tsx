import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BOOK_BY_CODE } from '../reading/books'
import { formatVerseRanges } from './verseTagParser'

interface VerseTagChipProps {
  book: string
  chapter: number
  verseNumbers: number[]
  verseIds: string[]
}

export function VerseTagChip({ book, chapter, verseNumbers, verseIds }: VerseTagChipProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const bookName = BOOK_BY_CODE[book]?.name ?? book
  const reference = `${bookName} ${chapter}:${formatVerseRanges(verseNumbers)}`

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && text === null) {
      setLoading(true)
      const { data } = await supabase
        .from('verses')
        .select('verse_id, text')
        .in('verse_id', verseIds)
        .eq('translation_code', 'KJV')
      // .in() doesn't preserve order, so re-join by walking verseIds
      // ourselves rather than trusting the returned row order.
      const textById = new Map((data ?? []).map((v) => [v.verse_id, v.text]))
      const joined = verseIds
        .map((id) => textById.get(id))
        .filter((t): t is string => Boolean(t))
        .join(' ')
      setText(joined || 'Verse text not found.')
      setLoading(false)
    }
  }

  return (
    <span className="verse-tag">
      <button type="button" className="verse-tag-chip" onClick={handleToggle}>
        {reference}
      </button>
      {open && (
        <span className="verse-tag-preview">
          <span className="verse-tag-preview-text">{loading ? 'Loading…' : text}</span>
          <Link to={`/?book=${book}&chapter=${chapter}`} className="verse-tag-preview-link">
            Open in reading view →
          </Link>
        </span>
      )}
    </span>
  )
}
