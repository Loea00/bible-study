import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNaveTopics } from './useNaveTopics'
import { formatReferenceRange, parseVerseId } from '../reading/books'

// Groups consecutive entries sharing the same label together, so "Marriage
// of: Ex 6:23" and "Children of: Ex 6:23, 25" render as labeled groups
// instead of a flat list — matching how Nave's own printed edition
// organizes a topic.
function groupByLabel(entries: { id: string; label: string | null; verse_start: string; verse_end: string }[]) {
  const groups: { label: string | null; refs: typeof entries }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.label === entry.label) {
      last.refs.push(entry)
    } else {
      groups.push({ label: entry.label, refs: [entry] })
    }
  }
  return groups
}

export function TopicsPage() {
  const [query, setQuery] = useState('')
  const { matchingTopics, selectedTopic, entries, loading, error, searchTopics, openTopic, closeTopic } =
    useNaveTopics()

  useEffect(() => {
    const id = setTimeout(() => searchTopics(query), 300)
    return () => clearTimeout(id)
  }, [query, searchTopics])

  const groups = groupByLabel(entries)

  return (
    <div className="topics-page">
      {!selectedTopic && (
        <>
          <input
            type="search"
            className="journal-search-input"
            placeholder="Search topics… (e.g. Faith, Forgiveness, Aaron)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {error && <p className="error">Couldn't search: {error}</p>}
          {loading && <p className="placeholder">Searching…</p>}
          {!loading && !error && query.trim() !== '' && matchingTopics.length === 0 && (
            <p className="placeholder">No topics match "{query.trim()}".</p>
          )}
          {!loading && query.trim() === '' && (
            <p className="placeholder">
              Search Nave's Topical Bible — 5,000+ topics mapped to relevant verses across
              scripture.
            </p>
          )}
          <div className="topics-list">
            {matchingTopics.map((topic) => (
              <button key={topic} type="button" className="topics-list-item" onClick={() => openTopic(topic)}>
                {topic}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedTopic && (
        <div className="topic-detail">
          <div className="verse-panel-header">
            <h2>{selectedTopic}</h2>
            <button type="button" className="picker-back" onClick={closeTopic}>
              Back
            </button>
          </div>
          {loading && <p className="placeholder">Loading…</p>}
          {error && <p className="error">Couldn't load this topic: {error}</p>}
          {!loading && !error && (
            <div className="topic-groups">
              {groups.map((group, i) => (
                <div key={i} className="topic-group">
                  {group.label && <h3 className="topic-group-label">{group.label}</h3>}
                  <p className="topic-group-refs">
                    {group.refs.map((ref, j) => {
                      const target = parseVerseId(ref.verse_start)
                      return (
                        <span key={ref.id}>
                          <Link
                            to={`/?book=${target.book}&chapter=${target.chapter}&verse=${target.verse}`}
                            className="verse-panel-ref-link"
                          >
                            {formatReferenceRange(ref.verse_start, ref.verse_end)}
                          </Link>
                          {j < group.refs.length - 1 && '; '}
                        </span>
                      )
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
