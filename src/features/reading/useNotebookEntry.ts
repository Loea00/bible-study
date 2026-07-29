import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseVerseTags } from '../journal/verseTagParser'
import { getVerifiedActiveSessionId } from './useReadingSession'

const AUTOSAVE_DELAY_MS = 800

export type NotebookSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// A persistent, autosaving journal entry for the reading view's Notebook
// mode -- unlike JournalEditor's explicit Save button, this is for live
// note-taking (a sermon, a conference) where losing a paragraph to a
// forgotten click would actually cost something. First keystroke creates
// the entry; every pause after that updates the same one in place.
export function useNotebookEntry() {
  const [entryId, setEntryId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [status, setStatus] = useState<NotebookSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(async () => {
    if (!body.trim()) return
    setStatus('saving')
    setError(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Not signed in')

      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      const verseTags = parseVerseTags(body)

      let id = entryId
      if (id) {
        const { error: updateError } = await supabase
          .from('entries')
          .update({ title: title.trim() || null, body, tags, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (updateError) throw new Error(updateError.message)
        await supabase.from('verse_references').delete().eq('entry_id', id).eq('ref_kind', 'inline')
      } else {
        const { data: entry, error: insertError } = await supabase
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
            session_id: await getVerifiedActiveSessionId(),
            request_id: null,
            highlight_id: null,
          })
          .select()
          .single()
        if (insertError) throw new Error(insertError.message)
        id = entry.id
        setEntryId(entry.id)
      }

      if (verseTags.length > 0) {
        const { error: refError } = await supabase.from('verse_references').insert(
          verseTags.flatMap((t) =>
            t.verseIds.map((verseId) => ({
              entry_id: id,
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

      setStatus('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setStatus('error')
    }
  }, [entryId, title, body, tagsInput])

  // Always points at the latest save closure so the debounce timeout and
  // the unmount/close flush never fire a stale one holding an old body.
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!body.trim()) return
    const timeout = setTimeout(() => {
      void saveRef.current()
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [title, body, tagsInput])

  // Flushes on unmount (navigating away from the reading page entirely)
  // so the last few keystrokes before the debounce window elapses aren't
  // lost.
  useEffect(() => {
    return () => {
      void saveRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function reset() {
    setEntryId(null)
    setTitle('')
    setBody('')
    setTagsInput('')
    setStatus('idle')
    setError(null)
  }

  // Used when the Notebook is explicitly closed -- flush immediately
  // (bypassing the debounce) then clear the draft, so reopening starts a
  // fresh entry rather than resuming the one just closed.
  async function close() {
    await saveRef.current()
    reset()
  }

  return { title, setTitle, body, setBody, tagsInput, setTagsInput, status, error, close }
}
