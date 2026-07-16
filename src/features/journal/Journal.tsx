import { useJournalEntries } from './useJournalEntries'
import { JournalEditor } from './JournalEditor'
import { JournalEntryCard } from './JournalEntryCard'

export function Journal() {
  const { entries, loading, createEntry, deleteEntry } = useJournalEntries()

  return (
    <div className="journal">
      <JournalEditor onSave={createEntry} />

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="placeholder">Nothing written yet — your first entry starts the timeline.</p>
      )}

      <div className="journal-timeline">
        {entries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} onDelete={deleteEntry} />
        ))}
      </div>
    </div>
  )
}
