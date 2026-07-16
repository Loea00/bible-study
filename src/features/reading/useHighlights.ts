import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Highlight, HighlightColor } from '../../types/db'

interface VerseHighlight {
  highlightId: string
  color: HighlightColor
}

export function useHighlights(book: string, chapter: number) {
  const [byVerse, setByVerse] = useState<Record<string, VerseHighlight>>({})

  const refetch = useCallback(async () => {
    // Phase 1 only ever writes single-span, whole-verse highlight groups, so
    // a full per-user fetch + client-side filter is simple and cheap at this
    // scale. If highlight volume grows, promote `spans` to a child table and
    // query that directly instead (spec amendment v1.1 §A3).
    const { data } = await supabase.from('highlights').select('*')

    const prefix = `${book}.${chapter}.`
    const grouped: Record<string, VerseHighlight> = {}
    for (const h of (data ?? []) as Highlight[]) {
      if (!Array.isArray(h.spans)) continue
      for (const span of h.spans) {
        if (span.verse_id.startsWith(prefix)) {
          grouped[span.verse_id] = { highlightId: h.id, color: h.color }
        }
      }
    }
    setByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function setHighlight(verseId: string, color: HighlightColor | null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const existing = byVerse[verseId]

    if (color === null) {
      if (!existing) return
      const { error } = await supabase.from('highlights').delete().eq('id', existing.highlightId)
      if (error) throw error
      setByVerse((prev) => {
        const next = { ...prev }
        delete next[verseId]
        return next
      })
      return
    }

    if (existing) {
      const { error } = await supabase
        .from('highlights')
        .update({ color })
        .eq('id', existing.highlightId)
      if (error) throw error
      setByVerse((prev) => ({ ...prev, [verseId]: { highlightId: existing.highlightId, color } }))
      return
    }

    const { data: inserted, error } = await supabase
      .from('highlights')
      .insert({
        user_id: userId,
        color,
        translation: null,
        spans: [{ verse_id: verseId, start_offset: null, end_offset: null }],
      })
      .select()
      .single()
    if (error) throw error

    setByVerse((prev) => ({ ...prev, [verseId]: { highlightId: inserted.id, color } }))
  }

  const colorByVerse = Object.fromEntries(
    Object.entries(byVerse).map(([verseId, v]) => [verseId, v.color]),
  ) as Record<string, HighlightColor>

  return { colorByVerse, setHighlight }
}
