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
  // Full rows (not just the per-verse-flattened view), kept so an existing
  // highlight's complete span group — which can spread across verses beyond
  // the current chapter view — can be recovered for editing.
  const [raw, setRaw] = useState<Highlight[]>([])

  const refetch = useCallback(async () => {
    // Fetch all of the user's highlights and filter client-side — fine at
    // Phase 1–2 scale (spec amendment v1.1 §A3). If volume grows, promote
    // `spans` to a child table and query that directly instead.
    const { data } = await supabase.from('highlights').select('*')
    const rows = (data ?? []) as Highlight[]
    setRaw(rows)

    const prefix = `${book}.${chapter}.`
    const grouped: Record<string, StoredHighlight[]> = {}
    for (const h of rows) {
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

  // Null offsets only occur on highlights predating span anchoring
  // (migrated with a null start/end meaning "whole verse" — see migration
  // 0004); reconstructing the real length would need the verse text, which
  // this hook doesn't fetch. Editing one of those legacy rows starts from a
  // zero-length span for that verse rather than the true whole-verse extent
  // — acceptable given how rare a pre-migration row still is in practice.
  function getHighlightSpans(highlightId: string): SelectionSpan[] {
    const highlight = raw.find((h) => h.id === highlightId)
    if (!highlight) return []
    return highlight.spans.map((s) => ({
      verseId: s.verse_id,
      startOffset: s.start_offset ?? 0,
      endOffset: s.end_offset ?? 0,
    }))
  }

  function getHighlight(highlightId: string): Highlight | undefined {
    return raw.find((h) => h.id === highlightId)
  }

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

  async function updateHighlight(highlightId: string, spans: SelectionSpan[], color: HighlightColor) {
    const { error } = await supabase
      .from('highlights')
      .update({
        color,
        spans: spans.map((s) => ({
          verse_id: s.verseId,
          start_offset: s.startOffset,
          end_offset: s.endOffset,
        })),
      })
      .eq('id', highlightId)
    if (error) throw error
    await refetch()
  }

  async function removeHighlight(highlightId: string) {
    const { error } = await supabase.from('highlights').delete().eq('id', highlightId)
    if (error) throw error
    setRaw((prev) => prev.filter((h) => h.id !== highlightId))
    setByVerse((prev) => {
      const next: Record<string, StoredHighlight[]> = {}
      for (const [verseId, list] of Object.entries(prev)) {
        next[verseId] = list.filter((h) => h.id !== highlightId)
      }
      return next
    })
  }

  return {
    highlightsByVerse: byVerse,
    createHighlight,
    updateHighlight,
    removeHighlight,
    getHighlightSpans,
    getHighlight,
  }
}
