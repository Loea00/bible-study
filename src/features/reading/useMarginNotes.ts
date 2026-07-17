import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry } from '../../types/db'
import { getActiveSessionId } from './useReadingSession'
import type { SelectionSpan } from './selection'

export function useMarginNotes(book: string, chapter: number) {
  const [notesByVerse, setNotesByVerse] = useState<Record<string, Entry[]>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('entry_type', 'margin_note')
      .like('anchor_start', `${book}.${chapter}.%`)
      .order('created_at', { ascending: true })

    const grouped: Record<string, Entry[]> = {}
    for (const entry of data ?? []) {
      if (!entry.anchor_start) continue
      ;(grouped[entry.anchor_start] ??= []).push(entry)
    }
    setNotesByVerse(grouped)
    setLoading(false)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addNote(spans: SelectionSpan[], body: string, translation: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (spans.length === 0) throw new Error('Nothing selected')

    const anchorStart = spans[0].verseId
    const anchorEnd = spans[spans.length - 1].verseId

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'margin_note',
        title: null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: anchorStart,
        anchor_end: anchorEnd,
        tags: [],
        session_id: getActiveSessionId(),
      })
      .select()
      .single()

    if (error) throw error

    const { error: refError } = await supabase.from('verse_references').insert(
      spans.map((s) => ({
        entry_id: entry.id,
        user_id: userId,
        verse_start: s.verseId,
        verse_end: s.verseId,
        position: null,
        ref_kind: 'anchor' as const,
        start_offset: s.startOffset,
        end_offset: s.endOffset,
        translation,
      })),
    )
    if (refError) throw refError

    // Register under the anchor verse (matches how notes are fetched/kept
    // in sync); notes anchored elsewhere in the chapter surface next load.
    setNotesByVerse((prev) => ({
      ...prev,
      [anchorStart]: [...(prev[anchorStart] ?? []), entry],
    }))
  }

  async function deleteNote(verseId: string, entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw error

    setNotesByVerse((prev) => ({
      ...prev,
      [verseId]: (prev[verseId] ?? []).filter((n) => n.id !== entryId),
    }))
  }

  return { notesByVerse, loading, addNote, deleteNote }
}
