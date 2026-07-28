import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry } from '../../types/db'
import { parseVerseTags } from '../journal/verseTagParser'
import { getActiveSessionId } from '../reading/useReadingSession'

// Free-form writing attached to one specific highlight -- distinct from a
// Reflection, which anchors to arbitrary passage spans with no highlight
// involved. Chronological oldest-first, same as usePrayerEntries.ts's
// "journey" ordering.
export function useHighlightArtifacts(highlightId: string) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('highlight_id', highlightId)
      .order('created_at', { ascending: true })
    setEntries(data ?? [])
    setLoading(false)
  }, [highlightId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addEntry(title: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (!body.trim()) throw new Error('Write something first')

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'highlight_artifact',
        title: title.trim() || null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: null,
        anchor_end: null,
        tags: [],
        session_id: getActiveSessionId(),
        request_id: null,
        highlight_id: highlightId,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    const verseTags = parseVerseTags(body)
    if (verseTags.length > 0) {
      const { error: refError } = await supabase.from('verse_references').insert(
        verseTags.flatMap((t) =>
          t.verseIds.map((verseId) => ({
            entry_id: entry.id,
            user_id: userId,
            verse_start: verseId,
            verse_end: verseId,
            position: t.start,
            ref_kind: 'inline' as const,
          })),
        ),
      )
      if (refError) throw new Error(refError.message)
    }

    setEntries((prev) => [...prev, entry])
    return entry
  }

  async function updateEntry(entryId: string, title: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data: entry, error } = await supabase
      .from('entries')
      .update({ title: title.trim() || null, body, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    const { error: deleteError } = await supabase
      .from('verse_references')
      .delete()
      .eq('entry_id', entryId)
      .eq('ref_kind', 'inline')
    if (deleteError) throw new Error(deleteError.message)

    const verseTags = parseVerseTags(body)
    if (verseTags.length > 0) {
      const { error: refError } = await supabase.from('verse_references').insert(
        verseTags.flatMap((t) =>
          t.verseIds.map((verseId) => ({
            entry_id: entryId,
            user_id: userId,
            verse_start: verseId,
            verse_end: verseId,
            position: t.start,
            ref_kind: 'inline' as const,
          })),
        ),
      )
      if (refError) throw new Error(refError.message)
    }

    setEntries((prev) => prev.map((e) => (e.id === entryId ? entry : e)))
    return entry
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw new Error(error.message)
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry }
}
