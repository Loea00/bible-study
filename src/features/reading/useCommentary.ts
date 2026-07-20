import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseVerseId } from './books'
import type { CommentaryEntry } from '../../types/db'

// Chapter-scoped fetch, grouped by every verse a commentary entry covers
// (not just verse_start) — commentators often comment on several
// consecutive verses in one entry (e.g. MHCC's "Verses 1-2"), so tapping
// verse 2 needs to find the same entry verse 1 would.
export function useCommentary(book: string, chapter: number) {
  const [commentaryByVerse, setCommentaryByVerse] = useState<Record<string, CommentaryEntry[]>>({})

  const refetch = useCallback(async () => {
    const prefix = `${book}.${chapter}.`
    const { data, error } = await supabase
      .from('commentary_entries')
      .select('*')
      .like('verse_start', `${prefix}%`)

    if (error) throw new Error(error.message)

    const grouped: Record<string, CommentaryEntry[]> = {}
    for (const row of data ?? []) {
      const start = parseVerseId(row.verse_start)
      const end = parseVerseId(row.verse_end)
      for (let v = start.verse; v <= end.verse; v++) {
        const verseId = `${book}.${chapter}.${v}`
        ;(grouped[verseId] ??= []).push(row)
      }
    }
    setCommentaryByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { commentaryByVerse }
}
