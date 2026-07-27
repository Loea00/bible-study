import { useCallback, useEffect, useState } from 'react'
import type { CalendarDayData } from './useCalendarDay'
import { fetchCalendarDay } from './useCalendarDay'
import { localDateKey } from './dateUtils'

const LOOKBACK_YEARS = 10

export interface OnThisDayYear extends CalendarDayData {
  year: number
  yearsAgo: number
}

// Not one range query -- "same month+day, any prior year" isn't a
// contiguous timestamp range. Runs useCalendarDay's query shape once per
// candidate prior year, in parallel; empty years resolve fast and get
// filtered out, no account-creation lookup needed.
export function useOnThisDay(date: Date) {
  const [years, setYears] = useState<OnThisDayYear[]>([])
  const [loading, setLoading] = useState(true)
  const dateKey = localDateKey(date)

  const refetch = useCallback(async () => {
    setLoading(true)
    const candidates = Array.from({ length: LOOKBACK_YEARS }, (_, i) => i + 1)
    const results = await Promise.all(
      candidates.map(async (yearsAgo) => {
        const candidateDate = new Date(date.getFullYear() - yearsAgo, date.getMonth(), date.getDate())
        const data = await fetchCalendarDay(candidateDate)
        return { ...data, year: candidateDate.getFullYear(), yearsAgo }
      }),
    )
    setYears(
      results
        .filter((r) => r.sessions.length > 0 || r.entries.length > 0 || r.answeredPrayers.length > 0)
        .sort((a, b) => a.yearsAgo - b.yearsAgo),
    )
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { years, loading }
}
