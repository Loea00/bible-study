import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PrayerRequest, PrayerRequestStatus, PrayerVisibility } from '../../types/db'

export function usePrayerRequests() {
  const [requests, setRequests] = useState<PrayerRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    // Since migration 0019, RLS also returns requests shared *with* the
    // current user (not just their own) — an explicit user_id filter here
    // keeps this hook scoped to "my requests" as every existing caller
    // expects. Requests shared with me live in useSharedWithMe instead.
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setRequests([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('prayer_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
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

  async function setPrivacy(requestId: string, isPrivate: boolean) {
    const { error } = await supabase.from('prayer_requests').update({ is_private: isPrivate }).eq('id', requestId)
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, is_private: isPrivate } : r)))
  }

  async function setVisibility(requestId: string, visibility: PrayerVisibility) {
    const { error } = await supabase.from('prayer_requests').update({ visibility }).eq('id', requestId)
    if (error) throw new Error(error.message)
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, visibility } : r)))
  }

  return {
    requests,
    loading,
    createRequest,
    updateRequest,
    markAnswered,
    setStatus,
    deleteRequest,
    setPrivacy,
    setVisibility,
  }
}
