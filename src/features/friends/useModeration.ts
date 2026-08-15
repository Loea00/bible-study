import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Block, Profile, ReportTargetType } from '../../types/db'

// Moderation minimum (spec-amendment-v1-2 §B7.4) — block/unblock and
// report filing. Reports are reviewed manually via the Supabase dashboard,
// not an in-app admin panel (deliberately out of scope here).
export function useModeration() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('blocks').select('*').order('created_at', { ascending: false })
    const rows = data ?? []
    setBlocks(rows)

    const blockedIds = [...new Set(rows.map((b) => b.blocked_id))]
    if (blockedIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', blockedIds)
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

  // Also removes any friendship with this person — blocking someone you're
  // still friends with in the database would be a contradiction the app
  // has no other way to resolve.
  async function blockUser(blockedId: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { error } = await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: blockedId })
    if (error) throw new Error(error.message)

    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${userId})`,
      )

    await refetch()
  }

  async function unblockUser(blockId: string) {
    const { error } = await supabase.from('blocks').delete().eq('id', blockId)
    if (error) throw new Error(error.message)
    await refetch()
  }

  async function reportContent(targetType: ReportTargetType, targetId: string, reason: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in')

    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: userId, target_type: targetType, target_id: targetId, reason: reason.trim() })
    if (error) throw new Error(error.message)
  }

  return { blocks, profilesById, loading, blockUser, unblockUser, reportContent }
}
