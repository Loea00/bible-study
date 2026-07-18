import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Lightweight id -> title lookup so the Journal timeline can link a
// prayer-attached entry back to its request without a full join.
export function usePrayerRequestTitles() {
  const [titleById, setTitleById] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('prayer_requests').select('id, title')
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
