import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { TskCrossReference } from '../../types/db'

// Chapter-scoped fetch grouped by from_verse_id, same shape as
// useJournalExcerpts/useMarginNotes. Reference data (spec §5.1), no auth
// needed — RLS policy is open read.
export function useCrossReferences(book: string, chapter: number) {
  const [crossReferencesByVerse, setCrossReferencesByVerse] = useState<
    Record<string, TskCrossReference[]>
  >({})

  const refetch = useCallback(async () => {
    const prefix = `${book}.${chapter}.`
    const { data, error } = await supabase
      .from('tsk_cross_references')
      .select('*')
      .like('from_verse_id', `${prefix}%`)

    if (error) throw new Error(error.message)

    const grouped: Record<string, TskCrossReference[]> = {}
    for (const row of data ?? []) {
      ;(grouped[row.from_verse_id] ??= []).push(row)
    }
    setCrossReferencesByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { crossReferencesByVerse }
}
