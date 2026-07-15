import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Verse } from '../../types/db'

export function useVerses(book: string, chapter: number, translation: string) {
  const [verses, setVerses] = useState<Verse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('verses')
      .select('*')
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('translation_code', translation)
      .order('verse', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
        } else {
          setVerses(data ?? [])
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [book, chapter, translation])

  return { verses, loading, error }
}
