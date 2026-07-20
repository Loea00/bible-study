import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScriptureSearch } from './useScriptureSearch'
import { BOOK_BY_CODE } from '../reading/books'
import type { Verse } from '../../types/db'

const TRANSLATIONS = ['KJV', 'ASV']

function ResultRow({ v }: { v: Verse }) {
  return (
    <Link to={`/?book=${v.book}&chapter=${v.chapter}&verse=${v.verse}`} className="scripture-search-result">
      <span className="scripture-search-result-ref">
        {BOOK_BY_CODE[v.book]?.name ?? v.book} {v.chapter}:{v.verse}
      </span>
      <p className="scripture-search-result-text">{v.text}</p>
    </Link>
  )
}

export function ScriptureSearch() {
  const [query, setQuery] = useState('')
  const [translation, setTranslation] = useState('KJV')
  const { exactResults, relatedResults, isPhraseQuery, loading, error, search } = useScriptureSearch()

  // Debounced search-as-you-type, same spirit as the journal search box but
  // hitting the DB per query instead of filtering already-loaded data.
  useEffect(() => {
    const id = setTimeout(() => search(query, translation), 300)
    return () => clearTimeout(id)
  }, [query, translation, search])

  const noResults = exactResults.length === 0 && relatedResults.length === 0

  return (
    <div className="scripture-search">
      <div className="scripture-search-controls">
        <input
          type="search"
          className="journal-search-input"
          placeholder='Search scripture… (use "quotes" for an exact phrase)'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
          {TRANSLATIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">Couldn't search: {error}</p>}
      {loading && <p className="placeholder">Searching…</p>}
      {!loading && !error && query.trim() !== '' && noResults && (
        <p className="placeholder">No verses match "{query.trim()}".</p>
      )}
      {!loading && query.trim() === '' && (
        <p className="placeholder">
          Search for a word or phrase across the whole Bible. Wrap text in "quotes" for an exact
          phrase, or prefix a word with - to exclude it.
        </p>
      )}

      {!isPhraseQuery && (
        <>
          {exactResults.length === 200 && (
            <p className="scripture-search-cap">Showing the first 200 matches — try a more specific phrase.</p>
          )}
          <div className="scripture-search-results">
            {exactResults.map((v) => (
              <ResultRow key={v.verse_id} v={v} />
            ))}
          </div>
        </>
      )}

      {isPhraseQuery && exactResults.length > 0 && (
        <div className="scripture-search-section">
          <h2 className="scripture-search-section-title">Exact matches</h2>
          {exactResults.length === 200 && (
            <p className="scripture-search-cap">Showing the first 200 matches — try a more specific phrase.</p>
          )}
          <div className="scripture-search-results">
            {exactResults.map((v) => (
              <ResultRow key={v.verse_id} v={v} />
            ))}
          </div>
        </div>
      )}

      {isPhraseQuery && relatedResults.length > 0 && (
        <div className="scripture-search-section">
          <h2 className="scripture-search-section-title">Related matches</h2>
          <p className="scripture-search-section-hint">Mentions the same words, not as that exact phrase.</p>
          {relatedResults.length === 200 && (
            <p className="scripture-search-cap">Showing the first 200 matches — try a more specific phrase.</p>
          )}
          <div className="scripture-search-results">
            {relatedResults.map((v) => (
              <ResultRow key={v.verse_id} v={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
