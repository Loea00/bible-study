import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayedMark } from '../../types/db'
import { getActiveSessionId } from '../reading/useReadingSession'

// One-tap gesture, deliberately writing-free (spec-amendment-v1-2 §B4) —
// timestamp only, no note. Fetched unscoped (like useAllHighlights) and
// grouped by request_id since Phase 2 scale doesn't need pagination yet.
export function usePrayedMarks() {
  const [marksByRequest, setMarksByRequest] = useState<Record<string, PrayedMark[]>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('prayed_marks').select('*').order('created_at', { ascending: false })
    const grouped: Record<string, PrayedMark[]> = {}
    for (const m of data ?? []) {
      ;(grouped[m.request_id] ??= []).push(m)
    }
    setMarksByRequest(grouped)
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addMark(requestId: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data, error } = await supabase
      .from('prayed_marks')
      .insert({ request_id: requestId, user_id: userId, session_id: getActiveSessionId() })
      .select()
      .single()
    if (error) throw new Error(error.message)

    setMarksByRequest((prev) => ({
      ...prev,
      [requestId]: [data, ...(prev[requestId] ?? [])],
    }))
    return data
  }

  return { marksByRequest, loading, addMark }
}
