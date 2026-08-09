import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// Every table that holds a user's own artifacts (RLS already scopes each of
// these selects to auth.uid() automatically, so no explicit filter is
// needed). user_settings is deliberately excluded — it holds only the
// privacy_pin_hash, a credential, not an artifact.
const EXPORT_TABLES = [
  'entries',
  'verse_references',
  'reading_sessions',
  'highlights',
  'prayer_lists',
  'prayer_requests',
  'prayed_marks',
] as const

export function useDataExport() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportData() {
    setError(null)
    setExporting(true)
    try {
      const data: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
      }
      for (const table of EXPORT_TABLES) {
        const { data: rows, error: queryError } = await supabase.from(table).select('*')
        if (queryError) throw queryError
        data[table] = rows
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `theo-export-${date}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export data.')
    } finally {
      setExporting(false)
    }
  }

  return { exportData, exporting, error }
}
