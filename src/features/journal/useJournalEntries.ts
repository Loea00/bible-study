import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry } from '../../types/db'
import { parseVerseTags } from './verseTagParser'
import { getActiveSessionId } from '../reading/useReadingSession'

export function useJournalEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('entry_type', 'journal')
      .order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function createEntry(title: string, body: string, tags: string[]) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'journal',
        title: title.trim() || null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: null,
        anchor_end: null,
        tags,
        session_id: getActiveSessionId(),
      })
      .select()
      .single()
    if (error) throw error

    const verseTags = parseVerseTags(body)
    if (verseTags.length > 0) {
      const { error: refError } = await supabase.from('verse_references').insert(
        verseTags.map((t) => ({
          entry_id: entry.id,
          user_id: userId,
          verse_start: t.verseId,
          verse_end: t.verseId,
          position: t.start,
          ref_kind: 'inline' as const,
        })),
      )
      if (refError) throw refError
    }

    setEntries((prev) => [entry, ...prev])
    return entry
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw error
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  return { entries, loading, createEntry, deleteEntry }
}
