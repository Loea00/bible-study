import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Highlight, HighlightColor } from '../../types/db'
import type { SelectionSpan } from './selection'
import type { RenderedHighlight } from './VerseText'

interface StoredHighlight extends RenderedHighlight {
  id: string
}

export function useHighlights(book: string, chapter: number, translation: string) {
  const [byVerse, setByVerse] = useState<Record<string, StoredHighlight[]>>({})

  const refetch = useCallback(async () => {
    // Fetch all of the user's highlights and filter client-side — fine at
    // Phase 1–2 scale (spec amendment v1.1 §A3). If volume grows, promote
    // `spans` to a child table and query that directly instead.
    const { data } = await supabase.from('highlights').select('*')

    const prefix = `${book}.${chapter}.`
    const grouped: Record<string, StoredHighlight[]> = {}
    for (const h of (data ?? []) as Highlight[]) {
      if (!Array.isArray(h.spans)) continue
      for (const span of h.spans) {
        if (!span.verse_id.startsWith(prefix)) continue
        ;(grouped[span.verse_id] ??= []).push({
          id: h.id,
          color: h.color,
          // Null offsets mean "whole verse" (legacy whole-verse-tap
          // highlights, or the verse-number fast path). Infinity as the end
          // sentinel means containment checks work without needing to know
          // the verse's text length at fetch time.
          startOffset: span.start_offset ?? 0,
          endOffset: span.end_offset ?? Number.POSITIVE_INFINITY,
        })
      }
    }
    setByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function createHighlight(spans: SelectionSpan[], color: HighlightColor) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { error } = await supabase.from('highlights').insert({
      user_id: userId,
      color,
      translation,
      spans: spans.map((s) => ({
        verse_id: s.verseId,
        start_offset: s.startOffset,
        end_offset: s.endOffset,
      })),
    })
    if (error) throw error
    await refetch()
  }

  async function removeHighlight(highlightId: string) {
    const { error } = await supabase.from('highlights').delete().eq('id', highlightId)
    if (error) throw error
    setByVerse((prev) => {
      const next: Record<string, StoredHighlight[]> = {}
      for (const [verseId, list] of Object.entries(prev)) {
        next[verseId] = list.filter((h) => h.id !== highlightId)
      }
      return next
    })
  }

  return { highlightsByVerse: byVerse, createHighlight, removeHighlight }
}
