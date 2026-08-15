import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayerShare } from '../../types/db'

// Who a single request is shared with — "named friends," not "all my
// friends" (spec-amendment-v1-2 §B7.1).
export function usePrayerShares(requestId: string) {
  const [shares, setShares] = useState<PrayerShare[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('prayer_shares').select('*').eq('request_id', requestId)
    setShares(data ?? [])
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function shareWith(friendId: string) {
    const { error } = await supabase.from('prayer_shares').insert({ request_id: requestId, shared_with_id: friendId })
    if (error) throw new Error(error.message)
    await refetch()
  }

  async function unshareWith(shareId: string) {
    const { error } = await supabase.from('prayer_shares').delete().eq('id', shareId)
    if (error) throw new Error(error.message)
    await refetch()
  }

  return { shares, loading, shareWith, unshareWith }
}
