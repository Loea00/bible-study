import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, EntryType } from '../../types/db'
import { parseVerseTags } from '../journal/verseTagParser'
import { getActiveSessionId } from '../reading/useReadingSession'

export type PrayerEntryType = Extract<EntryType, 'prayer_update' | 'word' | 'concern'>

// Writing attached to a request's lifecycle (spec-amendment-v1-2 §B2/§B3) —
// progress notes, sensed words, fears, insights. Chronological oldest-first
// since this reads as a history/narrative, the opposite of Journal's
// newest-first timeline.
export function usePrayerEntries(requestId: string) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    setEntries(data ?? [])
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addEntry(entryType: PrayerEntryType, title: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (!body.trim()) throw new Error('Write something first')

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: entryType,
        title: title.trim() || null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: null,
        anchor_end: null,
        tags: [],
        session_id: getActiveSessionId(),
        request_id: requestId,
      })
      .select()
      .single()
    if (error) throw error

    // Inline @verse tags cross-reference scripture the same way journal
    // entries do — the request's history is first-class writing, not a
    // second-tier note store.
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

    setEntries((prev) => [...prev, entry])
    return entry
  }

  async function updateEntry(entryId: string, entryType: PrayerEntryType, title: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data: entry, error } = await supabase
      .from('entries')
      .update({ entry_type: entryType, title: title.trim() || null, body, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single()
    if (error) throw error

    const { error: deleteError } = await supabase
      .from('verse_references')
      .delete()
      .eq('entry_id', entryId)
      .eq('ref_kind', 'inline')
    if (deleteError) throw deleteError

    const verseTags = parseVerseTags(body)
    if (verseTags.length > 0) {
      const { error: refError } = await supabase.from('verse_references').insert(
        verseTags.map((t) => ({
          entry_id: entryId,
          user_id: userId,
          verse_start: t.verseId,
          verse_end: t.verseId,
          position: t.start,
          ref_kind: 'inline' as const,
        })),
      )
      if (refError) throw refError
    }

    setEntries((prev) => prev.map((e) => (e.id === entryId ? entry : e)))
    return entry
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw error
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry }
}
