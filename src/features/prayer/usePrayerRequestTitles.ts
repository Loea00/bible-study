import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Lightweight id -> title lookup so the Journal timeline can link a
// prayer-attached entry back to its request without a full join.
export function usePrayerRequestTitles() {
  const [titleById, setTitleById] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      // Since migration 0019, RLS also returns requests shared with me —
      // scoped to my own here since this lookup only ever needs to resolve
      // titles for my own prayer-attached entries.
      const { data } = await supabase.from('prayer_requests').select('id, title').eq('user_id', userId)
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const r of data ?? []) map[r.id] = r.title
      setTitleById(map)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return titleById
}
