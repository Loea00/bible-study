import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Highlight } from '../../types/db'

// Unscoped by book/chapter, unlike useHighlights.ts — this is the "every
// highlight across the whole Bible" list, not a single-chapter read model.
export function useAllHighlights() {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [textByKey, setTextByKey] = useState<Record<string, string>>({})

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('highlights').select('*').order('created_at', { ascending: false })
    setHighlights((data ?? []) as Highlight[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Fetch quoted text for every span across every highlight in one pass,
  // grouped by translation (spans can come from highlights made in
  // different translations) — keyed "translation:verse_id" since the same
  // verse can appear at different text across translations.
  useEffect(() => {
    if (highlights.length === 0) {
      setTextByKey({})
      return
    }

    const byTranslation = new Map<string, Set<string>>()
    for (const h of highlights) {
      const translation = h.translation ?? 'KJV'
      const ids = byTranslation.get(translation) ?? new Set<string>()
      for (const span of h.spans) ids.add(span.verse_id)
      byTranslation.set(translation, ids)
    }

    let cancelled = false
    Promise.all(
      [...byTranslation.entries()].map(([translation, ids]) =>
        supabase
          .from('verses')
          .select('verse_id, text')
          .in('verse_id', [...ids])
          .eq('translation_code', translation)
          .then(({ data }) => ({ translation, rows: (data ?? []) as { verse_id: string; text: string }[] })),
      ),
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const { translation, rows } of results) {
        for (const v of rows) map[`${translation}:${v.verse_id}`] = v.text
      }
      setTextByKey(map)
    })

    return () => {
      cancelled = true
    }
  }, [highlights])

  async function removeHighlight(highlightId: string) {
    const { error } = await supabase.from('highlights').delete().eq('id', highlightId)
    if (error) throw new Error(error.message)
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId))
  }

  return { highlights, loading, textByKey, removeHighlight }
}
