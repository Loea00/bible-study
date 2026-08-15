import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types/db'

// The current user's own profile row — display name / real name are what
// friend search matches against and what shows up in friends lists, share
// notices, and encouragement attribution.
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function updateProfile(displayName: string, fullName: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null, full_name: fullName.trim() || null })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(data)
    return data
  }

  return { profile, loading, updateProfile }
}
