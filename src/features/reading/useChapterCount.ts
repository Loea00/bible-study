import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function useChapterCount(book: string | null, translation: string) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!book) {
      setCount(null)
      return
    }
    let cancelled = false

    supabase
      .from('verses')
      .select('chapter')
      .eq('book', book)
      .eq('translation_code', translation)
      .order('chapter', { ascending: false })
      .limit(1)
      .returns<{ chapter: number }[]>()
      .then(({ data }) => {
        if (cancelled) return
        setCount(data?.[0]?.chapter ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [book, translation])

  return count
}
