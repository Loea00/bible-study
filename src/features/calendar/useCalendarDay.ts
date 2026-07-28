import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, PrayerRequest, ReadingSession } from '../../types/db'
import { addDays, localDateKey, startOfDay } from './dateUtils'

export interface CalendarDayData {
  sessions: ReadingSession[]
  entries: Entry[]
  answeredPrayers: PrayerRequest[]
}

export async function fetchCalendarDay(date: Date): Promise<CalendarDayData> {
  const rangeStart = startOfDay(date).toISOString()
  const rangeEnd = addDays(date, 1).toISOString()

  const [sessionsRes, entriesRes, answeredRes] = await Promise.all([
    supabase.from('reading_sessions').select('*').gte('started_at', rangeStart).lt('started_at', rangeEnd),
    supabase.from('entries').select('*').gte('created_at', rangeStart).lt('created_at', rangeEnd),
    supabase.from('prayer_requests').select('*').gte('answered_at', rangeStart).lt('answered_at', rangeEnd),
  ])

  return {
    sessions: sessionsRes.data ?? [],
    entries: entriesRes.data ?? [],
    answeredPrayers: answeredRes.data ?? [],
  }
}

export function useCalendarDay(date: Date) {
  const [data, setData] = useState<CalendarDayData>({ sessions: [], entries: [], answeredPrayers: [] })
  const [loading, setLoading] = useState(true)
  const dateKey = localDateKey(date)

  const refetch = useCallback(async () => {
    setLoading(true)
    setData(await fetchCalendarDay(date))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function deleteSession(sessionId: string) {
    const { error } = await supabase.from('reading_sessions').delete().eq('id', sessionId)
    if (error) throw new Error(error.message)
    setData((prev) => ({ ...prev, sessions: prev.sessions.filter((s) => s.id !== sessionId) }))
  }

  async function deleteEntry(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw new Error(error.message)
    setData((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== entryId) }))
  }

  // "Removing" an answered prayer from the day just un-answers it (clears
  // answered_at/answered_note) rather than deleting the prayer request
  // itself -- the request keeps existing, it just stops showing up on this
  // day. A real delete of the whole request stays on the Prayer page.
  async function unmarkAnswered(requestId: string) {
    const { error } = await supabase
      .from('prayer_requests')
      .update({ status: 'active', answered_at: null, answered_note: null })
      .eq('id', requestId)
    if (error) throw new Error(error.message)
    setData((prev) => ({ ...prev, answeredPrayers: prev.answeredPrayers.filter((r) => r.id !== requestId) }))
  }

  return { ...data, loading, deleteSession, deleteEntry, unmarkAnswered }
}
