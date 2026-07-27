import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { endOfYear, localDateKey, startOfYear } from './dateUtils'
import { BOOK_BY_CODE, parseVerseId } from '../reading/books'

export interface CalendarYearStats {
  chaptersCovered: number
  mostRevisitedPassage: string | null
  prayersAnswered: number
  firstActivity: Date | null
  lastActivity: Date | null
}

const EMPTY_STATS: CalendarYearStats = {
  chaptersCovered: 0,
  mostRevisitedPassage: null,
  prayersAnswered: 0,
  firstActivity: null,
  lastActivity: null,
}

export function useCalendarYear(year: number) {
  const [dayMap, setDayMap] = useState<Map<string, number>>(new Map())
  const [stats, setStats] = useState<CalendarYearStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const rangeStart = startOfYear(year).toISOString()
    const rangeEnd = new Date(endOfYear(year).getTime() + 24 * 60 * 60 * 1000).toISOString()

    const [sessionsRes, entriesRes, answeredRes] = await Promise.all([
      supabase
        .from('reading_sessions')
        .select('started_at, passage_start, passage_end')
        .gte('started_at', rangeStart)
        .lt('started_at', rangeEnd),
      supabase.from('entries').select('created_at').gte('created_at', rangeStart).lt('created_at', rangeEnd),
      supabase
        .from('prayer_requests')
        .select('answered_at')
        .gte('answered_at', rangeStart)
        .lt('answered_at', rangeEnd),
    ])

    const sessions = sessionsRes.data ?? []
    const entries = entriesRes.data ?? []
    const answered = answeredRes.data ?? []

    const map = new Map<string, number>()
    const bump = (key: string) => map.set(key, (map.get(key) ?? 0) + 1)
    for (const row of sessions) bump(localDateKey(new Date(row.started_at)))
    for (const row of entries) bump(localDateKey(new Date(row.created_at)))
    setDayMap(map)

    // Most-revisited passage: frequency by book+chapter bucket, ties
    // resolve to the most-recently-visited of the tied set -- simple,
    // deterministic, no "and also" list needed at this usage scale.
    const chapterFreq = new Map<string, { count: number; lastVisited: string; label: string }>()
    const chapterSet = new Set<string>()
    for (const row of sessions) {
      if (!row.passage_start) continue
      const { book, chapter } = parseVerseId(row.passage_start)
      const key = `${book}.${chapter}`
      chapterSet.add(key)
      const label = `${BOOK_BY_CODE[book]?.name ?? book} ${chapter}`
      const existing = chapterFreq.get(key)
      if (!existing || row.started_at > existing.lastVisited) {
        chapterFreq.set(key, { count: (existing?.count ?? 0) + 1, lastVisited: row.started_at, label })
      } else {
        existing.count += 1
      }
    }
    let mostRevisited: string | null = null
    let bestCount = 0
    let bestLastVisited = ''
    for (const { count, lastVisited, label } of chapterFreq.values()) {
      if (count > bestCount || (count === bestCount && lastVisited > bestLastVisited)) {
        bestCount = count
        bestLastVisited = lastVisited
        mostRevisited = label
      }
    }

    const allTimestamps = [
      ...sessions.map((s) => s.started_at),
      ...entries.map((e) => e.created_at),
    ].sort()

    setStats({
      chaptersCovered: chapterSet.size,
      mostRevisitedPassage: mostRevisited,
      prayersAnswered: answered.length,
      firstActivity: allTimestamps.length > 0 ? new Date(allTimestamps[0]) : null,
      lastActivity: allTimestamps.length > 0 ? new Date(allTimestamps[allTimestamps.length - 1]) : null,
    })

    setLoading(false)
  }, [year])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { dayMap, stats, loading }
}
