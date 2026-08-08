import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// A user-defined PIN that gates the display of entries/prayer requests
// marked Private -- see 0018_privacy_pin.sql for why this is a UI-level
// "glance protection" feature, not encryption. The raw PIN never lingers
// client-side after being set: hashing and comparison both happen inside
// Postgres via the set_privacy_pin/verify_privacy_pin RPCs.
export function usePrivacyPin() {
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null)

  const refetch = useCallback(async () => {
    const { data } = await supabase.from('user_settings').select('privacy_pin_hash').maybeSingle()
    setPinConfigured(!!data?.privacy_pin_hash)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function setPin(pin: string) {
    if (!pin.trim()) throw new Error('Enter a PIN first')
    const { error } = await supabase.rpc('set_privacy_pin', { pin })
    if (error) throw new Error(error.message)
    setPinConfigured(true)
  }

  async function verifyPin(pin: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_privacy_pin', { pin })
    if (error) throw new Error(error.message)
    return !!data
  }

  return { pinConfigured, setPin, verifyPin }
}
