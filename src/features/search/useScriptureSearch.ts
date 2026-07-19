import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compareVerseIds } from '../reading/books'
import type { Verse } from '../../types/db'

// Full-text search over verses.search_vector (migration 0010) — a Postgres
// generated tsvector column, so this is a plain textSearch() call, no RPC
// needed. Capped at 200 results, same spirit as the concordance's 300-cap.
export function useScriptureSearch() {
  const [results, setResults] = useState<Verse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string, translation: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('verses')
      .select('verse_id, translation_code, book, chapter, verse, text')
      .eq('translation_code', translation)
      .textSearch('search_vector', trimmed, { type: 'plain', config: 'english' })
      .limit(200)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const rows = (data ?? []) as Verse[]
    rows.sort((a, b) => compareVerseIds(a.verse_id, b.verse_id))
    setResults(rows)
  }, [])

  return { results, loading, error, search }
}
