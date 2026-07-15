import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry } from '../../types/db'

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

  async function addNote(verseId: string, body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data: entry, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'margin_note',
        title: null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: verseId,
        anchor_end: verseId,
        tags: [],
        session_id: null,
      })
      .select()
      .single()

    if (error) throw error

    await supabase.from('verse_references').insert({
      entry_id: entry.id,
      user_id: userId,
      verse_start: verseId,
      verse_end: verseId,
      position: null,
      ref_kind: 'anchor',
    })

    setNotesByVerse((prev) => ({
      ...prev,
      [verseId]: [...(prev[verseId] ?? []), entry],
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
