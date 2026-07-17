import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { WordTag } from '../../types/db'

export type { WordTag }

export function useWordTags(book: string, chapter: number, translation: string) {
  const [tagsByVerse, setTagsByVerse] = useState<Record<string, WordTag[]>>({})

  useEffect(() => {
    let cancelled = false

    supabase
      .from('word_tags')
      .select('*')
      .like('verse_id', `${book}.${chapter}.%`)
      .eq('translation_code', translation)
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const grouped: Record<string, WordTag[]> = {}
        for (const tag of (data ?? []) as WordTag[]) {
          ;(grouped[tag.verse_id] ??= []).push(tag)
        }
        setTagsByVerse(grouped)
      })

    return () => {
      cancelled = true
    }
  }, [book, chapter, translation])

  return tagsByVerse
}
