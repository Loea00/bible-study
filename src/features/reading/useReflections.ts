import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getActiveSessionId } from './useReadingSession'
import { parseVerseTags } from '../journal/verseTagParser'
import type { SelectionSpan } from './selection'

export interface ReflectionExcerpt {
  entryId: string
  title: string | null
  date: string
  opening: string
}

function openingLines(body: string, length = 140): string {
  const trimmed = body.trim()
  return trimmed.length > length ? `${trimmed.slice(0, length).trim()}…` : trimmed
}

export function useReflections(book: string, chapter: number) {
  const [reflectionsByVerse, setReflectionsByVerse] = useState<Record<string, ReflectionExcerpt[]>>({})

  // A reflection anchors across every verse it was selected over (like a
  // highlight group), not just entries.anchor_start — so this looks up
  // every ref_kind='anchor' row touching the current chapter and joins to
  // the owning entry, the same two-step shape useJournalExcerpts.ts uses
  // for inline tags.
  const refetch = useCallback(async () => {
    const prefix = `${book}.${chapter}.`
    const { data: refs } = await supabase
      .from('verse_references')
      .select('*')
      .eq('ref_kind', 'anchor')
      .like('verse_start', `${prefix}%`)

    if (!refs || refs.length === 0) {
      setReflectionsByVerse({})
      return
    }

    const entryIds = [...new Set(refs.map((r) => r.entry_id))]
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .in('id', entryIds)
      .eq('entry_type', 'reflection')

    const entryById = new Map((entries ?? []).map((e) => [e.id, e]))
    const grouped: Record<string, ReflectionExcerpt[]> = {}
    // A multi-span reflection can have more than one anchor row for the
    // same verse (rare, but possible) — dedupe per (verse, entry) so it
    // doesn't show up twice in that verse's panel.
    const seen = new Set<string>()

    for (const ref of refs) {
      const entry = entryById.get(ref.entry_id)
      if (!entry) continue
      const key = `${ref.verse_start}:${entry.id}`
      if (seen.has(key)) continue
      seen.add(key)
      ;(grouped[ref.verse_start] ??= []).push({
        entryId: entry.id,
        title: entry.title,
        date: entry.created_at,
        opening: openingLines(entry.body),
      })
    }
    setReflectionsByVerse(grouped)
  }, [book, chapter])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addReflection(spans: SelectionSpan[], title: string, body: string, translation: string) {
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
        entry_type: 'reflection',
        title: title.trim() || null,
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

    // Anchored to the whole passage automatically (spec §5.3, ref_kind:
    // 'anchor') — one row per span, same shape useMarginNotes.addNote writes.
    const { error: anchorError } = await supabase.from('verse_references').insert(
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
    if (anchorError) throw anchorError

    // Inline @verse tags to *other* passages still work, connecting
    // passages through the user's thinking (spec §5.3) — same mechanism
    // the journal editor already uses.
    const inlineTags = parseVerseTags(body)
    if (inlineTags.length > 0) {
      const { error: inlineError } = await supabase.from('verse_references').insert(
        inlineTags.map((t) => ({
          entry_id: entry.id,
          user_id: userId,
          verse_start: t.verseId,
          verse_end: t.verseId,
          position: t.start,
          ref_kind: 'inline' as const,
        })),
      )
      if (inlineError) throw inlineError
    }

    await refetch()
    return entry
  }

  return { reflectionsByVerse, addReflection }
}
