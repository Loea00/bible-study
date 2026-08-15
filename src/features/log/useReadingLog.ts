import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, ReadingSession } from '../../types/db'
import { clearActiveSessionIfAmong } from '../reading/useReadingSession'

export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Consecutive local calendar days with at least one session, walking back
// from today. Not having read *yet* today doesn't break the streak — it
// checks yesterday first if today has nothing yet (principle 3: gentle,
// never enforced).
export function computeStreak(sessions: ReadingSession[]): number {
  if (sessions.length === 0) return 0
  const days = new Set(sessions.map((s) => localDateKey(new Date(s.started_at))))
  let streak = 0
  const cursor = new Date()
  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (days.has(localDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function useReadingLog() {
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [notesThisMonth, setNotesThisMonth] = useState(0)
  const [entriesBySession, setEntriesBySession] = useState<Record<string, Entry[]>>({})
  const [prayedCountBySession, setPrayedCountBySession] = useState<Record<string, number>>({})

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setSessions([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('reading_sessions')
      .select('*')
      .order('started_at', { ascending: false })
    setSessions(data ?? [])

    // Fetched eagerly (not per-session on expand) so every row can show an
    // artifact-count indicator up front, not just after tapping into it.
    // entries gets an explicit user_id filter since migration 0019 also
    // makes a friend's encouragement entries readable via RLS — this log
    // is "my sessions," not "everything I can read."
    const [entriesRes, prayedRes] = await Promise.all([
      supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .not('session_id', 'is', null)
        .order('created_at', { ascending: true }),
      supabase.from('prayed_marks').select('request_id, session_id').not('session_id', 'is', null),
    ])

    const entryMap: Record<string, Entry[]> = {}
    for (const entry of entriesRes.data ?? []) {
      if (!entry.session_id) continue
      ;(entryMap[entry.session_id] ??= []).push(entry)
    }
    setEntriesBySession(entryMap)

    // Distinct requests, not raw mark count — "prayed for 2 requests" (spec
    // §B3) counts what was prayed for, not how many taps happened.
    const requestsBySession: Record<string, Set<string>> = {}
    for (const mark of prayedRes.data ?? []) {
      if (!mark.session_id) continue
      ;(requestsBySession[mark.session_id] ??= new Set()).add(mark.request_id)
    }
    const prayedCounts: Record<string, number> = {}
    for (const [sessionId, requestIds] of Object.entries(requestsBySession)) {
      prayedCounts[sessionId] = requestIds.size
    }
    setPrayedCountBySession(prayedCounts)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth)
    setNotesThisMonth(count ?? 0)

    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Only removes the log line item (the reading_sessions row) -- notes,
  // journal entries, and reflections written during it are NOT deleted,
  // just unlinked (entries.session_id -> set null via the FK), same as
  // deleting a whole day below.
  async function deleteSession(sessionId: string) {
    const { error } = await supabase.from('reading_sessions').delete().eq('id', sessionId)
    if (error) throw new Error(error.message)
    clearActiveSessionIfAmong([sessionId])
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }

  async function deleteSessionsForDay(sessionIds: string[]) {
    const { error } = await supabase.from('reading_sessions').delete().in('id', sessionIds)
    if (error) throw new Error(error.message)
    clearActiveSessionIfAmong(sessionIds)
    const idSet = new Set(sessionIds)
    setSessions((prev) => prev.filter((s) => !idSet.has(s.id)))
  }

  return {
    sessions,
    loading,
    notesThisMonth,
    streak: computeStreak(sessions),
    entriesBySession,
    prayedCountBySession,
    deleteSession,
    deleteSessionsForDay,
  }
}
