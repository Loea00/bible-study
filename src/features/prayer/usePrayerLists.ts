import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayerList } from '../../types/db'

export function usePrayerLists() {
  const [lists, setLists] = useState<PrayerList[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('prayer_lists')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setLists(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function createList(name: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const sortOrder = lists.length > 0 ? Math.max(...lists.map((l) => l.sort_order)) + 1 : 0
    const { data, error } = await supabase
      .from('prayer_lists')
      .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
      .select()
      .single()
    if (error) throw error

    setLists((prev) => [...prev, data])
    return data
  }

  async function renameList(listId: string, name: string) {
    const { error } = await supabase.from('prayer_lists').update({ name: name.trim() }).eq('id', listId)
    if (error) throw error
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name: name.trim() } : l)))
  }

  // Requests under this list fall back to unlisted (list_id -> null via the
  // migration's `on delete set null`) rather than being deleted with it.
  async function deleteList(listId: string) {
    const { error } = await supabase.from('prayer_lists').delete().eq('id', listId)
    if (error) throw error
    setLists((prev) => prev.filter((l) => l.id !== listId))
  }

  return { lists, loading, createList, renameList, deleteList }
}
