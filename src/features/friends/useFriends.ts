import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Friendship, Profile } from '../../types/db'

export interface SearchProfileResult {
  id: string
  display_name: string | null
  full_name: string | null
  email_match: boolean
}

export function useFriends() {
  const [userId, setUserId] = useState<string | null>(null)
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  const [searchResults, setSearchResults] = useState<SearchProfileResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id ?? null
    setUserId(uid)

    const { data: friendshipRows } = await supabase
      .from('friendships')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = friendshipRows ?? []
    setFriendships(rows)

    const otherIds = new Set<string>()
    for (const f of rows) otherIds.add(f.requester_id === uid ? f.addressee_id : f.requester_id)

    if (otherIds.size > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', [...otherIds])
      const byId: Record<string, Profile> = {}
      for (const p of profileRows ?? []) byId[p.id] = p
      setProfilesById(byId)
    } else {
      setProfilesById({})
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee_id === userId)
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester_id === userId)
  const accepted = friendships.filter((f) => f.status === 'accepted')

  // useCallback with an empty dependency array gives this a stable
  // reference across renders — without it, every state change this
  // function itself causes (searching/searchResults) would recreate the
  // function, which the debounce effect in FriendsPage depends on,
  // re-triggering the effect and calling search again in a loop. Same
  // pattern as useNaveTopics.searchTopics, which this mirrors.
  const searchUsers = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchError(null)
      return
    }
    setSearching(true)
    setSearchError(null)
    const { data, error } = await supabase.rpc('search_profiles', { query: trimmed })
    setSearching(false)
    if (error) {
      setSearchError(error.message)
      return
    }
    setSearchResults(data ?? [])
  }, [])

  async function sendRequest(targetId: string) {
    if (!userId) throw new Error('Not signed in')
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: targetId })
    if (error) throw new Error(error.message)
    await refetch()
  }

  async function acceptRequest(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', friendshipId)
    if (error) throw new Error(error.message)
    await refetch()
  }

  // Covers three cases with one call: declining an incoming request,
  // canceling an outgoing one, and unfriending an accepted one — all are
  // just "delete this friendships row."
  async function removeFriendship(friendshipId: string) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) throw new Error(error.message)
    await refetch()
  }

  async function loadInviteCode() {
    const { data, error } = await supabase.rpc('get_or_create_invite_code')
    if (error) throw new Error(error.message)
    setInviteCode(data)
    return data
  }

  async function acceptInvite(code: string) {
    const { data, error } = await supabase.rpc('accept_invite', { code })
    if (error) throw new Error(error.message)
    await refetch()
    return data
  }

  return {
    loading,
    userId,
    incoming,
    outgoing,
    accepted,
    profilesById,
    searchResults,
    searching,
    searchError,
    searchUsers,
    sendRequest,
    acceptRequest,
    removeFriendship,
    inviteCode,
    loadInviteCode,
    acceptInvite,
  }
}
