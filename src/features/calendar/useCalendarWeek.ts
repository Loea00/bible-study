import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, PrayerRequest, ReadingSession } from '../../types/db'
import { addDays, localDateKey } from './dateUtils'

export interface CalendarWeekData {
  sessions: ReadingSession[]
  entries: Entry[]
  answeredPrayers: PrayerRequest[]
}

// Same three-query shape as useCalendarMonth, scoped to 7 days -- but
// keeps the RAW rows (not just per-day booleans), since composeWeekSummary
// needs real passage strings and counts, not just presence flags.
export function useCalendarWeek(weekStart: Date) {
  const [data, setData] = useState<CalendarWeekData>({ sessions: [], entries: [], answeredPrayers: [] })
  const [loading, setLoading] = useState(true)
  const weekStartKey = localDateKey(weekStart)

  const refetch = useCallback(async () => {
    setLoading(true)
    const rangeStart = weekStart.toISOString()
    const rangeEnd = addDays(weekStart, 7).toISOString()

    // See useCalendarDay.ts's fetchCalendarDay for why entries/prayer_requests
    // need an explicit user_id filter since migration 0019.
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setData({ sessions: [], entries: [], answeredPrayers: [] })
      setLoading(false)
      return
    }

    const [sessionsRes, entriesRes, answeredRes] = await Promise.all([
      supabase.from('reading_sessions').select('*').gte('started_at', rangeStart).lt('started_at', rangeEnd),
      supabase.from('entries').select('*').eq('user_id', userId).gte('created_at', rangeStart).lt('created_at', rangeEnd),
      supabase
        .from('prayer_requests')
        .select('*')
        .eq('user_id', userId)
        .gte('answered_at', rangeStart)
        .lt('answered_at', rangeEnd),
    ])

    setData({
      sessions: sessionsRes.data ?? [],
      entries: entriesRes.data ?? [],
      answeredPrayers: answeredRes.data ?? [],
    })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ...data, loading }
}
