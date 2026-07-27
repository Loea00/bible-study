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

  return { ...data, loading }
}
