import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, ReadingSession } from '../../types/db'

function localDateKey(d: Date): string {
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

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reading_sessions')
      .select('*')
      .order('started_at', { ascending: false })
    setSessions(data ?? [])

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth)
    setNotesThisMonth(count ?? 0)

    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function loadSessionEntries(sessionId: string) {
    if (entriesBySession[sessionId]) return
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setEntriesBySession((prev) => ({ ...prev, [sessionId]: data ?? [] }))
  }

  return {
    sessions,
    loading,
    notesThisMonth,
    streak: computeStreak(sessions),
    entriesBySession,
    loadSessionEntries,
  }
}
