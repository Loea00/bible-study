import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { compareVerseIds } from '../reading/books'
import type { NaveTopic } from '../../types/db'

// Search-as-you-type over topic names (a DB-side RPC since plain
// select() has no DISTINCT and a topic can have hundreds of verse rows —
// see search_nave_topics in migration 0012), plus loading one topic's
// full, ordered list of (label, verse) entries on demand.
export function useNaveTopics() {
  const [matchingTopics, setMatchingTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [entries, setEntries] = useState<NaveTopic[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchTopics = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setMatchingTopics([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('search_nave_topics', { query: trimmed })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setMatchingTopics((data ?? []).map((r) => r.topic))
  }, [])

  const openTopic = useCallback(async (topic: string) => {
    setSelectedTopic(topic)
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('nave_topics').select('*').eq('topic', topic)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const rows = (data ?? []) as NaveTopic[]
    rows.sort((a, b) => compareVerseIds(a.verse_start, b.verse_start))
    setEntries(rows)
  }, [])

  const closeTopic = useCallback(() => {
    setSelectedTopic(null)
    setEntries([])
  }, [])

  return { matchingTopics, selectedTopic, entries, loading, error, searchTopics, openTopic, closeTopic }
}
