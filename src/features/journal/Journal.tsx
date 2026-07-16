import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJournalEntries } from './useJournalEntries'
import { JournalEditor } from './JournalEditor'
import { JournalEntryCard } from './JournalEntryCard'

export function Journal() {
  const { entries, loading, createEntry, deleteEntry } = useJournalEntries()
  const [searchParams] = useSearchParams()
  const targetEntryId = searchParams.get('entry')
  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (targetEntryId && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [targetEntryId, loading])

  return (
    <div className="journal">
      <JournalEditor onSave={createEntry} />

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="placeholder">Nothing written yet — your first entry starts the timeline.</p>
      )}

      <div className="journal-timeline">
        {entries.map((entry) => (
          <div
            key={entry.id}
            ref={entry.id === targetEntryId ? targetRef : undefined}
            className={entry.id === targetEntryId ? 'journal-card-target' : undefined}
          >
            <JournalEntryCard entry={entry} onDelete={deleteEntry} />
          </div>
        ))}
      </div>
    </div>
  )
}
