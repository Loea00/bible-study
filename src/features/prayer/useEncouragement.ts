import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Entry, Profile } from '../../types/db'

// A friend's words of support on a shared request (spec-amendment-v1-2
// §B7.1) — a shared comment thread visible to the request's owner and
// everyone it's shared with (see 0019_friends_and_sharing.sql's
// entries_read_shared_encouragement policy), not owner-only.
export function useEncouragement(requestId: string) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [authorsById, setAuthorsById] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('request_id', requestId)
      .eq('entry_type', 'encouragement')
      .order('created_at', { ascending: true })
    const rows = data ?? []
    setEntries(rows)

    const authorIds = [...new Set(rows.map((e) => e.user_id))]
    if (authorIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', authorIds)
      const byId: Record<string, Profile> = {}
      for (const p of profileRows ?? []) byId[p.id] = p
      setAuthorsById(byId)
    } else {
      setAuthorsById({})
    }
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function addEncouragement(body: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (!body.trim()) throw new Error('Write something first')

    const { data, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        entry_type: 'encouragement',
        title: null,
        body,
        template_id: null,
        template_responses: null,
        anchor_start: null,
        anchor_end: null,
        tags: [],
        session_id: null,
        request_id: requestId,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    await refetch()
    return data
  }

  async function deleteEncouragement(entryId: string) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId)
    if (error) throw new Error(error.message)
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  return { entries, authorsById, loading, addEncouragement, deleteEncouragement }
}
