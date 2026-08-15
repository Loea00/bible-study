import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayerRequest, Profile } from '../../types/db'

// Requests friends have shared with me — RLS also returns my own requests
// from a plain select() since migration 0019, so this excludes user_id =
// me client-side to isolate just the "shared with me" set.
export function useSharedWithMe() {
  const [requests, setRequests] = useState<PrayerRequest[]>([])
  const [ownersById, setOwnersById] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setRequests([])
      setOwnersById({})
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('prayer_requests')
      .select('*')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
    const rows = data ?? []
    setRequests(rows)

    const ownerIds = [...new Set(rows.map((r) => r.user_id))]
    if (ownerIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', ownerIds)
      const byId: Record<string, Profile> = {}
      for (const p of profileRows ?? []) byId[p.id] = p
      setOwnersById(byId)
    } else {
      setOwnersById({})
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { requests, ownersById, loading, refetch }
}
