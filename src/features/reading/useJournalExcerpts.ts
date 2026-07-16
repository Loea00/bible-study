import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { extractExcerpt } from '../journal/excerpt'
import { parseVerseTags } from '../journal/verseTagParser'

export interface JournalExcerpt {
  entryId: string
  title: string | null
  date: string
  excerpt: string
}

export function useJournalExcerpts(book: string, chapter: number) {
  const [excerptsByVerse, setExcerptsByVerse] = useState<Record<string, JournalExcerpt[]>>({})

  const refetch = useCallback(async () => {
    const prefix = `${book}.${chapter}.`
    const { data: refs } = await supabase
      .from('verse_references')
      .select('*')
      .eq('ref_kind', 'inline')
      .like('verse_start', `${prefix}%`)

    if (!refs || refs.length === 0) {
      setExcerptsByVerse({})
      return
    }

    const entryIds = [...new Set(refs.map((r) => r.entry_id))]
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .in('id', entryIds)
      .eq('entry_type', 'journal')

    const entryById = new Map((entries ?? []).map((e) => [e.id, e]))
    const grouped: Record<string, JournalExcerpt[]> = {}

    for (const ref of refs) {
      const entry = entryById.get(ref.entry_id)
      if (!entry) continue
      const tag = parseVerseTags(entry.body).find(
        (t) => t.start === ref.position && t.verseId === ref.verse_start,
      )
      if (!tag) continue
      ;(grouped[ref.verse_start] ??= []).push({
        entryId: entry.id,
        title: entry.title,
        date: entry.created_at,
        excerpt: extractExcerpt(entry.body, tag.start, tag.end),
      })
    }
    setExcerptsByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { excerptsByVerse }
}
