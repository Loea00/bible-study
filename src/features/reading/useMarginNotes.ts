import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry } from '../../types/db'
import { getActiveSessionId } from './useReadingSession'
import type { SelectionSpan } from './selection'

export function useMarginNotes(book: string, chapter: number) {
  const [notesByVerse, setNotesByVerse] = useState<Record<string, Entry[]>>({})
  const [loading, setLoading] = useState(true)

  // A note can anchor across multiple, non-consecutive verses (like a
  // highlight group) — reading only entries.anchor_start (the first verse)
  // meant a multi-span note only ever appeared connected to one of its
  // parts. Look up every ref_kind='anchor' row touching this chapter and
  // join to the owning entry instead, the same two-step shape
  // useReflections.ts/useJournalExcerpts.ts already use.
  const refetch = useCallback(async () => {
    setLoading(true)
    const prefix = `${book}.${chapter}.`
    const { data: refs } = await supabase
      .from('verse_references')
      .select('*')
      .eq('ref_kind', 'anchor')
      .like('verse_start', `${prefix}%`)

    if (!refs || refs.length === 0) {
      setNotesByVerse({})
      setLoading(false)
      return
    }

    const entryIds = [...new Set(refs.map((r) => r.entry_id))]
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .in('id', entryIds)
      .eq('entry_type', 'margin_note')

    const entryById = new Map((entries ?? []).map((e) => [e.id, e]))
    const grouped: Record<string, Entry[]> = {}
    // A multi-span note can have more than one anchor row for the same
    // verse (rare, but possible) — dedupe per (verse, entry) so it doesn't
    // show up twice in that verse's panel.
    const seen = new Set<string>()

    for (const ref of refs) {
      const entry = entryById.get(ref.entry_id)
      if (!entry) continue
      const key = `${ref.verse_start}:${entry.id}`
      if (seen.has(key)) continue
      seen.add(key)
      ;(grouped[ref.verse_start] ??= []).push(entry)
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

    await refetch()
  }

  // Body text only — a note's anchor spans are immutable once created
  // (remove-and-recreate is the model, same as highlights), so this never
  // touches verse_references.
  async function updateNote(entryId: string, body: string) {
    const { error } = await supabase
      .from('entries')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', entryId)
    if (error) throw error

    setNotesByVerse((prev) => {
      const next: Record<string, Entry[]> = {}
      for (const [verseId, list] of Object.entries(prev)) {
        next[verseId] = list.map((n) => (n.id === entryId ? { ...n, body } : n))
      }
      return next
    })
  }

  async function deleteNote(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw error

    // A multi-span note can appear under several verses — remove it from
    // all of them, not just whichever verse's panel the delete was clicked
    // from (same pattern useHighlights.removeHighlight already uses).
    setNotesByVerse((prev) => {
      const next: Record<string, Entry[]> = {}
      for (const [verseId, list] of Object.entries(prev)) {
        next[verseId] = list.filter((n) => n.id !== entryId)
      }
      return next
    })
  }

  return { notesByVerse, loading, addNote, updateNote, deleteNote }
}
