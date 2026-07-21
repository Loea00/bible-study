import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BookIntroduction } from '../../types/db'

// Book-level, not chapter/verse-scoped -- only worth fetching on chapter
// 1 (where it's shown), so callers should only mount this when chapter
// === 1 rather than filtering client-side on every chapter.
export function useBookIntroductions(book: string) {
  const [introductions, setIntroductions] = useState<BookIntroduction[]>([])

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('book_introductions').select('*').eq('book', book)

    if (error) throw new Error(error.message)
    setIntroductions(data ?? [])
  }, [book])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { introductions }
}
