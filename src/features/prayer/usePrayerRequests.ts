import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayerRequest, PrayerRequestStatus } from '../../types/db'

export function usePrayerRequests() {
  const [requests, setRequests] = useState<PrayerRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('prayer_requests').select('*').order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function createRequest(title: string, description: string, listId: string | null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')
    if (!title.trim()) throw new Error('A title is required')

    const { data, error } = await supabase
      .from('prayer_requests')
      .insert({
        user_id: userId,
        list_id: listId,
        title: title.trim(),
        description: description.trim(),
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    setRequests((prev) => [data, ...prev])
    return data
  }

  async function updateRequest(requestId: string, title: string, description: string, listId: string | null) {
    const { data, error } = await supabase
      .from('prayer_requests')
      .update({ title: title.trim(), description: description.trim(), list_id: listId })
      .eq('id', requestId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.map((r) => (r.id === requestId ? data : r)))
  }

  // Answering carries a testimony (answered_note) alongside the status
  // flip; every other transition is a plain status change that clears any
  // stale answered_at/note left over from a prior answer.
  async function markAnswered(requestId: string, note: string) {
    const { data, error } = await supabase
      .from('prayer_requests')
      .update({ status: 'answered', answered_at: new Date().toISOString(), answered_note: note.trim() || null })
      .eq('id', requestId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.map((r) => (r.id === requestId ? data : r)))
  }

  async function setStatus(requestId: string, status: PrayerRequestStatus) {
    const update =
      status === 'answered'
        ? { status }
        : { status, answered_at: null, answered_note: null }
    const { data, error } = await supabase.from('prayer_requests').update(update).eq('id', requestId).select().single()
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.map((r) => (r.id === requestId ? data : r)))
  }

  async function deleteRequest(requestId: string) {
    const { error } = await supabase.from('prayer_requests').delete().eq('id', requestId)
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  return { requests, loading, createRequest, updateRequest, markAnswered, setStatus, deleteRequest }
}
