import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { extractExcerpt } from '../journal/excerpt'
import { parseVerseTags } from '../journal/verseTagParser'
import type { EntryType } from '../../types/db'

const PRAYER_TYPES: EntryType[] = ['prayer_update', 'word', 'concern', 'vision']

export interface JournalExcerpt {
  entryId: string
  title: string | null
  date: string
  excerpt: string
  entryType: EntryType
  requestId: string | null
}

// Also picks up prayer-attached writing (spec-amendment-v1-2 §B3: "entries
// attached to requests appear like any writing") — those have no anchor of
// their own, so an inline @verse tag is the only way one surfaces here.
// VersePanel splits the result back into "Journal" vs "Prayer" sections by
// entryType rather than this hook returning two separate lists, since it's
// one query either way.
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
    // Private entries are excluded outright here rather than shown as a
    // locked placeholder -- this is a secondary "also mentioned elsewhere"
    // pointer, not the entry's home page, so there's no unlock UI to put
    // it behind; the safest default is to not surface it at all until
    // it's made public again.
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .in('id', entryIds)
      .in('entry_type', ['journal', ...PRAYER_TYPES])
      .eq('is_private', false)

    const entryById = new Map((entries ?? []).map((e) => [e.id, e]))
    const grouped: Record<string, JournalExcerpt[]> = {}

    for (const ref of refs) {
      const entry = entryById.get(ref.entry_id)
      if (!entry) continue
      const tag = parseVerseTags(entry.body).find(
        (t) => t.start === ref.position && t.verseIds.includes(ref.verse_start),
      )
      if (!tag) continue
      ;(grouped[ref.verse_start] ??= []).push({
        entryId: entry.id,
        title: entry.title,
        date: entry.created_at,
        excerpt: extractExcerpt(entry.body, tag.start, tag.end),
        entryType: entry.entry_type,
        requestId: entry.request_id,
      })
    }
    setExcerptsByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { excerptsByVerse }
}
