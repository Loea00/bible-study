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

// For linking writing to "the reading session it was created during"
// (spec 4.2) — returns null if no session is active or it's gone stale.
// Cache-only, no DB round trip — safe for display/read paths, but NOT safe
// for anything that inserts session_id into `entries`, since the cached id
// can point at a row that was deleted elsewhere (see
// getVerifiedActiveSessionId below).
export function getActiveSessionId(): string | null {
  return loadStoredSession()?.id ?? null
}

// The write-safe version: every entry/mark-creation call site that stamps
// session_id should use this instead of getActiveSessionId(). Confirms the
// cached id still exists in `reading_sessions` before handing it back, and
// self-heals the cache (clears it) if not — this is what actually prevents
// entries_session_id_fkey, independent of which delete path caused the
// staleness or whether the reading view happened to be revisited since.
export async function getVerifiedActiveSessionId(): Promise<string | null> {
  const id = getActiveSessionId()
  if (!id) return null
  const { data } = await supabase.from('reading_sessions').select('id').eq('id', id).maybeSingle()
  if (!data) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
  return id
}

// Deleting a reading_sessions row (Reading Log or Calendar Day view) must
// drop the cached pointer too if it points at the row just deleted —
// otherwise the next note/journal/reflection/prayer/highlight-artifact
// write stamps itself with a session_id that no longer exists and the
// insert fails on entries_session_id_fkey. Without this, the stale pointer
// would otherwise only clear itself after the 30-minute gap or a fresh
// visit to the reading view.
export function clearActiveSessionIfAmong(sessionIds: string[]) {
  const stored = loadStoredSession()
  if (stored && sessionIds.includes(stored.id)) {
    localStorage.removeItem(STORAGE_KEY)
  }
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
        // A Postgres UPDATE matching zero rows is NOT an error (error stays
        // null even when the session was deleted) — `.select().maybeSingle()`
        // is required to actually detect "that row doesn't exist anymore"
        // via a null result, rather than silently re-caching a dead id.
        const { data: updated, error } = await supabase
          .from('reading_sessions')
          .update({ passage_end: passage, last_position: passage, ended_at: now })
          .eq('id', sessionId)
          .select()
          .maybeSingle()
        if (!error && updated) {
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
