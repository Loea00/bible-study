import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compareVerseIds } from '../reading/books'
import type { Verse } from '../../types/db'

// Full-text search over verses.search_vector (migration 0010) — a Postgres
// generated tsvector column. Unquoted queries use websearch_to_tsquery
// (type: 'websearch') for stemmed recall — "shepherd" also matches
// "shepherds".
//
// A quoted "phrase" gets two queries: an ilike literal substring match
// (genuinely exact — immune to stemming and to Postgres's english config
// treating "was"/"the"/"is" etc. as stopwords, which silently breaks
// phraseto_tsquery/websearch_to_tsquery phrase matching on Bible text,
// which is dense with exactly those words) for `exactResults`, plus a
// websearch_to_tsquery run on the same words (phrase requirement dropped)
// for `relatedResults` — verses that mention the same words but not as
// that exact phrase. relatedResults excludes anything already in
// exactResults so the two lists never overlap.
function escapeIlike(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

const VERSE_COLUMNS = 'verse_id, translation_code, book, chapter, verse, text'

export function useScriptureSearch() {
  const [exactResults, setExactResults] = useState<Verse[]>([])
  const [relatedResults, setRelatedResults] = useState<Verse[]>([])
  const [isPhraseQuery, setIsPhraseQuery] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string, translation: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setExactResults([])
      setRelatedResults([])
      setIsPhraseQuery(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)

    const phraseMatch = trimmed.match(/^"(.+)"$/)
    setIsPhraseQuery(phraseMatch !== null)
    const table = () => supabase.from('verses').select(VERSE_COLUMNS).eq('translation_code', translation)

    if (phraseMatch) {
      const phrase = phraseMatch[1]
      const [exact, related] = await Promise.all([
        table().ilike('text', `%${escapeIlike(phrase)}%`).limit(200),
        table().textSearch('search_vector', phrase, { type: 'websearch', config: 'english' }).limit(200),
      ])
      setLoading(false)
      if (exact.error) {
        setError(exact.error.message)
        return
      }
      if (related.error) {
        setError(related.error.message)
        return
      }
      const exactRows = (exact.data ?? []) as Verse[]
      exactRows.sort((a, b) => compareVerseIds(a.verse_id, b.verse_id))
      const exactIds = new Set(exactRows.map((v) => v.verse_id))
      const relatedRows = ((related.data ?? []) as Verse[]).filter((v) => !exactIds.has(v.verse_id))
      relatedRows.sort((a, b) => compareVerseIds(a.verse_id, b.verse_id))
      setExactResults(exactRows)
      setRelatedResults(relatedRows)
      return
    }

    const { data, error } = await table()
      .textSearch('search_vector', trimmed, { type: 'websearch', config: 'english' })
      .limit(200)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const rows = (data ?? []) as Verse[]
    rows.sort((a, b) => compareVerseIds(a.verse_id, b.verse_id))
    setExactResults(rows)
    setRelatedResults([])
  }, [])

  return { exactResults, relatedResults, isPhraseQuery, loading, error, search }
}
