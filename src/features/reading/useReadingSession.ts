import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// A "session" is a sitting: opening the reading view starts one, and it
// keeps rolling forward (ended_at ticks ahead on every passage change) as
// long as activity continues within SESSION_GAP_MS of the last touch. A
// longer gap — closing the tab, coming back tomorrow — starts a new one.
const STORAGE_KEY = 'bible-reading-session'
const SESSION_GAP_MS = 30 * 60 * 1000

interface StoredSession {
  id: string
  lastActivityAt: number
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (Date.now() - parsed.lastActivityAt > SESSION_GAP_MS) return null
    return parsed
  } catch {
    return null
  }
}

function saveStoredSession(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

// No verse-level scroll tracking exists yet, so "position" is the chapter's
// first verse — a reasonable stand-in until reading-log/resume UI needs
// finer precision.
function passageId(book: string, chapter: number) {
  return `${book}.${chapter}.1`
}

export function useReadingSession(book: string, chapter: number) {
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function touch() {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      const passage = passageId(book, chapter)
      const now = new Date().toISOString()

      let sessionId = sessionIdRef.current ?? loadStoredSession()?.id ?? null

      if (sessionId) {
        const { error } = await supabase
          .from('reading_sessions')
          .update({ passage_end: passage, last_position: passage, ended_at: now })
          .eq('id', sessionId)
        if (!error) {
          sessionIdRef.current = sessionId
          saveStoredSession({ id: sessionId, lastActivityAt: Date.now() })
          return
        }
        sessionId = null // stale/invalid — fall through and start a fresh one
      }

      const { data: created, error } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: userId,
          started_at: now,
          ended_at: now,
          passage_start: passage,
          passage_end: passage,
          last_position: passage,
        })
        .select()
        .single()

      if (!error && created) {
        sessionIdRef.current = created.id
        saveStoredSession({ id: created.id, lastActivityAt: Date.now() })
      }
    }

    touch()
  }, [book, chapter])
}
