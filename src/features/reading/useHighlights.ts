import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { HighlightColor } from '../../types/db'

export function useHighlights(book: string, chapter: number) {
  const [colorByVerse, setColorByVerse] = useState<Record<string, HighlightColor>>({})

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('highlights')
      .select('*')
      .like('verse_start', `${book}.${chapter}.%`)

    const grouped: Record<string, HighlightColor> = {}
    for (const h of data ?? []) {
      grouped[h.verse_start] = h.color
    }
    setColorByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function setHighlight(verseId: string, color: HighlightColor | null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    if (color === null) {
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('user_id', userId)
        .eq('verse_start', verseId)
        .eq('verse_end', verseId)
      if (error) throw error
      setColorByVerse((prev) => {
        const next = { ...prev }
        delete next[verseId]
        return next
      })
      return
    }

    const { error } = await supabase
      .from('highlights')
      .upsert(
        { user_id: userId, verse_start: verseId, verse_end: verseId, color },
        { onConflict: 'user_id,verse_start,verse_end' },
      )
    if (error) throw error
    setColorByVerse((prev) => ({ ...prev, [verseId]: color }))
  }

  return { colorByVerse, setHighlight }
}
