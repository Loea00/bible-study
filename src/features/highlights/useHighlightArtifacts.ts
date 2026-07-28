import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, Highlight } from '../../types/db'
import { parseVerseTags } from '../journal/verseTagParser'
import { getVerifiedActiveSessionId } from '../reading/useReadingSession'

// Writing composed against a specific highlight, from the Highlights page.
// This is a margin_note anchored to the highlight's own spans (same anchor
// shape openNoteFromHighlight's reading-pane flow writes) with highlight_id
// set for cross-reference -- unified this way (rather than a distinct
// entry_type with no anchor) so a note shows up in BOTH the Highlights page
// and the verse panel for that passage, regardless of which surface it was
// written on. Chronological oldest-first, same as usePrayerEntries.ts's
// "journey" ordering.
export function useHighlightArtifacts(highlight: Highlight) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('highlight_id', highlight.id)
      .order('created_at', { ascending: true })
    setEntries(data ?? [])
    setLoading(false)
  }, [highlight.id])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addEntry(title: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (!body.trim()) throw new Error('Write something first')

    const anchorStart = highlight.spans[0].verse_id
    const anchorEnd = highlight.spans[highlight.spans.length - 1].verse_id

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'margin_note',
        title: title.trim() || null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: anchorStart,
        anchor_end: anchorEnd,
        tags: [],
        session_id: await getVerifiedActiveSessionId(),
        request_id: null,
        highlight_id: highlight.id,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    const { error: anchorError } = await supabase.from('verse_references').insert(
      highlight.spans.map((s) => ({
        entry_id: entry.id,
        user_id: userId,
        verse_start: s.verse_id,
        verse_end: s.verse_id,
        position: null,
        ref_kind: 'anchor' as const,
        start_offset: s.start_offset,
        end_offset: s.end_offset,
        translation: highlight.translation,
      })),
    )
    if (anchorError) throw new Error(anchorError.message)

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
