import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BOOK_BY_CODE } from '../reading/books'

interface VerseTagChipProps {
  book: string
  chapter: number
  verse: number
  verseId: string
}

export function VerseTagChip({ book, chapter, verse, verseId }: VerseTagChipProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const bookName = BOOK_BY_CODE[book]?.name ?? book
  const reference = `${bookName} ${chapter}:${verse}`

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && text === null) {
      setLoading(true)
      const { data } = await supabase
        .from('verses')
        .select('text')
        .eq('verse_id', verseId)
        .eq('translation_code', 'KJV')
        .maybeSingle()
      setText(data?.text ?? 'Verse text not found.')
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
