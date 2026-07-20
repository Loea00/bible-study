import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compareVerseIds } from '../reading/books'
import type { Verse } from '../../types/db'

// Full-text search over verses.search_vector (migration 0010) — a Postgres
// generated tsvector column, so this is a plain textSearch() call, no RPC
// needed. Capped at 200 results, same spirit as the concordance's 300-cap.
// type: 'websearch' (-> websearch_to_tsquery) gives search-engine syntax for
// free: "quoted text" is meant to be an exact phrase, bare words AND
// together, "OR" and leading "-" work too.
//
// BUT: Postgres's 'english' config strips common words as stopwords —
// "was", "the", "is", "a"... — and a quoted phrase built entirely out of
// stopwords (e.g. "was the word") degrades to an empty/near-empty tsquery,
// silently losing the phrase requirement and matching almost anything.
// Since Bible text is full of exactly these words ("the LORD", "I am"),
// a query that's ENTIRELY one quoted phrase is instead run as a literal
// case-insensitive substring match (ilike) — genuinely exact, immune to
// stemming/stopwords, and matches what a user typing quotes actually wants.
function escapeIlike(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

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

    const phraseMatch = trimmed.match(/^"(.+)"$/)
    const base = supabase
      .from('verses')
      .select('verse_id, translation_code, book, chapter, verse, text')
      .eq('translation_code', translation)
    const { data, error } = await (phraseMatch
      ? base.ilike('text', `%${escapeIlike(phraseMatch[1])}%`).limit(200)
      : base.textSearch('search_vector', trimmed, { type: 'websearch', config: 'english' }).limit(200))

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
