import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { endOfMonth, localDateKey, startOfMonth } from './dateUtils'

export interface CalendarDayFlags {
  hasSession: boolean
  hasEntry: boolean
  answeredCount: number
}

// Bucketed by local day, not per-day queries -- one range query per table
// covers the whole visible month instead of 30+ round trips.
export function useCalendarMonth(year: number, month: number) {
  const [dayMap, setDayMap] = useState<Map<string, CalendarDayFlags>>(new Map())
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const rangeStart = startOfMonth(year, month).toISOString()
    const rangeEnd = new Date(endOfMonth(year, month).getTime() + 24 * 60 * 60 * 1000).toISOString()

    // See useCalendarDay.ts's fetchCalendarDay for why entries/prayer_requests
    // need an explicit user_id filter since migration 0019.
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setDayMap(new Map())
      setLoading(false)
      return
    }

    const [sessionsRes, entriesRes, answeredRes] = await Promise.all([
      supabase.from('reading_sessions').select('started_at').gte('started_at', rangeStart).lt('started_at', rangeEnd),
      supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd),
      supabase
        .from('prayer_requests')
        .select('answered_at')
        .eq('user_id', userId)
        .gte('answered_at', rangeStart)
        .lt('answered_at', rangeEnd),
    ])

    const map = new Map<string, CalendarDayFlags>()
    const flagFor = (key: string): CalendarDayFlags => {
      let flags = map.get(key)
      if (!flags) {
        flags = { hasSession: false, hasEntry: false, answeredCount: 0 }
        map.set(key, flags)
      }
      return flags
    }
    for (const row of sessionsRes.data ?? []) {
      flagFor(localDateKey(new Date(row.started_at))).hasSession = true
    }
    for (const row of entriesRes.data ?? []) {
      flagFor(localDateKey(new Date(row.created_at))).hasEntry = true
    }
    for (const row of answeredRes.data ?? []) {
      if (row.answered_at) flagFor(localDateKey(new Date(row.answered_at))).answeredCount += 1
    }

    setDayMap(map)
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { dayMap, loading }
}
