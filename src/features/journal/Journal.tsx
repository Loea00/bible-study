import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJournalEntries } from './useJournalEntries'
import { JournalEditor } from './JournalEditor'
import { JournalEntryCard } from './JournalEntryCard'

export function Journal() {
  const { entries, loading, createEntry, updateEntry, deleteEntry } = useJournalEntries()
  const [searchParams] = useSearchParams()
  const targetEntryId = searchParams.get('entry')
  const targetRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'all' | 'journal' | 'reflection'>('all')

  useEffect(() => {
    if (targetEntryId && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [targetEntryId, loading])

  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of entries) {
      for (const tag of entry.tags) seen.add(tag)
    }
    return [...seen].sort()
  }, [entries])

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (activeType !== 'all' && entry.entry_type !== activeType) return false
      if (activeTag && !entry.tags.includes(activeTag)) return false
      if (!q) return true
      return entry.title?.toLowerCase().includes(q) || entry.body.toLowerCase().includes(q)
    })
  }, [entries, query, activeTag, activeType])

  const isFiltering = query.trim() !== '' || activeTag !== null || activeType !== 'all'

  return (
    <div className="journal">
      <JournalEditor onSave={createEntry} />

      {entries.length > 0 && (
        <div className="journal-search">
          <div className="journal-type-filters">
            {(['all', 'journal', 'reflection'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`journal-type-filter${activeType === type ? ' active' : ''}`}
                onClick={() => setActiveType(type)}
              >
                {type === 'all' ? 'All' : type === 'journal' ? 'Journal' : 'Reflection'}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="journal-search-input"
            placeholder="Search your writing…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {allTags.length > 0 && (
            <div className="journal-tag-filters">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`journal-tag-filter${activeTag === tag ? ' active' : ''}`}
                  onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="placeholder">Nothing written yet — your first entry starts the timeline.</p>
      )}
      {!loading && entries.length > 0 && isFiltering && filteredEntries.length === 0 && (
        <p className="placeholder">Nothing matches that search.</p>
      )}

      <div className="journal-timeline">
        {filteredEntries.map((entry) => (
          <div
            key={entry.id}
            ref={entry.id === targetEntryId ? targetRef : undefined}
            className={entry.id === targetEntryId ? 'journal-card-target' : undefined}
          >
            <JournalEntryCard entry={entry} onEdit={updateEntry} onDelete={deleteEntry} />
          </div>
        ))}
      </div>
    </div>
  )
}
