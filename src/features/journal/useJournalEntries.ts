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
    // Reflections appear in the same timeline as journal entries, per spec
    // §5.3 ("in the journal timeline as a filterable type") — they're
    // authored via useReflections.addReflection, a separate write path
    // (different anchor semantics), so createEntry below stays journal-only.
    const { data } = await supabase
      .from('entries')
      .select('*')
      .in('entry_type', ['journal', 'reflection'])
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

  // Works for both journal and reflection entries — editing only ever
  // touches title/body/tags, never anchor_start/anchor_end or the
  // ref_kind='anchor' verse_references rows a reflection's passage anchor
  // depends on. Inline @verse tags can change on edit (added, removed, or
  // just moved), so the old ref_kind='inline' rows are replaced wholesale
  // rather than diffed.
  async function updateEntry(entryId: string, title: string, body: string, tags: string[]) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data: entry, error } = await supabase
      .from('entries')
      .update({ title: title.trim() || null, body, tags, updated_at: new Date().toISOString() })
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

  return { entries, loading, createEntry, updateEntry, deleteEntry }
}
