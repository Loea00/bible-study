import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJournalEntries } from './useJournalEntries'
import { JournalEditor } from './JournalEditor'
import { JournalEntryCard } from './JournalEntryCard'
import { usePrivacyPin } from '../settings/usePrivacyPin'
import { useInputPosition } from '../../lib/useInputPosition'

export function Journal() {
  const { entries, loading, createEntry, updateEntry, deleteEntry, setPrivacy } = useJournalEntries()
  const { pinConfigured, verifyPin } = usePrivacyPin()
  const [inputPosition, setInputPosition] = useInputPosition('theo:journal-input-position')
  const [searchParams] = useSearchParams()
  const targetEntryId = searchParams.get('entry')
  const targetRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'all' | 'journal' | 'reflection'>('journal')

  useEffect(() => {
    if (targetEntryId && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [targetEntryId, loading])

  // Private entries are excluded from the tag chip list, and from ever
  // *matching* a tag filter or text search — either would reveal something
  // about hidden content (that it has this tag, or contains this word)
  // without requiring the PIN. They still appear normally under the plain
  // type tabs / "All" with no query or tag active, as a locked card — you
  // need to be able to find your way to one to unlock it.
  const allTags = useMemo(() => {
    const seen = new Set<string>()
    for (const entry of entries) {
      if (entry.is_private) continue
      for (const tag of entry.tags) seen.add(tag)
    }
    return [...seen].sort()
  }, [entries])

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (activeType !== 'all' && entry.entry_type !== activeType) return false
      if (activeTag) {
        if (entry.is_private) return false
        if (!entry.tags.includes(activeTag)) return false
      }
      if (!q) return true
      if (entry.is_private) return false
      return entry.title?.toLowerCase().includes(q) || entry.body.toLowerCase().includes(q)
    })
  }, [entries, query, activeTag, activeType])

  const isFiltering = query.trim() !== '' || activeTag !== null || activeType !== 'all'

  return (
    <div className="journal">
      {inputPosition === 'top' && <JournalEditor onSave={createEntry} />}

      <div className="doorway-view-controls">
        <div className="doorway-toggle-group">
          <span className="doorway-toggle-label">New entry</span>
          <button
            type="button"
            className={`doorway-toggle-button${inputPosition === 'top' ? ' active' : ''}`}
            onClick={() => setInputPosition('top')}
          >
            Top
          </button>
          <button
            type="button"
            className={`doorway-toggle-button${inputPosition === 'bottom' ? ' active' : ''}`}
            onClick={() => setInputPosition('bottom')}
          >
            Bottom
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="journal-search">
          <div className="journal-type-filters">
            {(['journal', 'reflection', 'all'] as const).map((type) => (
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
            <JournalEntryCard
              entry={entry}
              onEdit={updateEntry}
              onDelete={deleteEntry}
              onSetPrivacy={setPrivacy}
              pinConfigured={pinConfigured}
              verifyPin={verifyPin}
            />
          </div>
        ))}
      </div>

      {inputPosition === 'bottom' && <JournalEditor onSave={createEntry} />}
    </div>
  )
}
