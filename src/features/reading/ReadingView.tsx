import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVerses } from './useVerses'
import { useMarginNotes } from './useMarginNotes'
import { useHighlights } from './useHighlights'
import { useJournalExcerpts } from './useJournalExcerpts'
import { PassagePicker } from './PassagePicker'
import { VersePanel } from './VersePanel'
import { BOOK_BY_CODE } from './books'
import type { Verse } from '../../types/db'

const TRANSLATIONS = ['KJV', 'ASV']

export function ReadingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const book = searchParams.get('book') ?? 'GEN'
  const chapter = Number.parseInt(searchParams.get('chapter') ?? '1', 10) || 1
  const [translation, setTranslation] = useState('KJV')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null)

  const { verses, loading, error } = useVerses(book, chapter, translation)
  const { notesByVerse, addNote, deleteNote } = useMarginNotes(book, chapter)
  const { colorByVerse, setHighlight } = useHighlights(book, chapter)
  const { excerptsByVerse } = useJournalExcerpts(book, chapter)
  const bookName = BOOK_BY_CODE[book]?.name ?? book

  function handleSelect(newBook: string, newChapter: number) {
    setSearchParams({ book: newBook, chapter: String(newChapter) })
    setPickerOpen(false)
  }

  return (
    <div className="reading-view">
      <div className="reading-controls">
        <button type="button" className="reference-button" onClick={() => setPickerOpen(true)}>
          {bookName} {chapter}
        </button>
        <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
          {TRANSLATIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {pickerOpen && (
        <PassagePicker
          translation={translation}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {selectedVerse && (
        <VersePanel
          verseId={selectedVerse.verse_id}
          verseText={selectedVerse.text}
          reference={`${bookName} ${selectedVerse.chapter}:${selectedVerse.verse}`}
          notes={notesByVerse[selectedVerse.verse_id] ?? []}
          journalExcerpts={excerptsByVerse[selectedVerse.verse_id] ?? []}
          highlightColor={colorByVerse[selectedVerse.verse_id] ?? null}
          onAddNote={(body) => addNote(selectedVerse.verse_id, body)}
          onDeleteNote={(entryId) => deleteNote(selectedVerse.verse_id, entryId)}
          onSetHighlight={(color) => setHighlight(selectedVerse.verse_id, color)}
          onClose={() => setSelectedVerse(null)}
        />
      )}

      {loading && <p className="placeholder">Loading…</p>}
      {error && <p className="placeholder">Couldn't load this passage: {error}</p>}
      {!loading && !error && verses.length === 0 && (
        <p className="placeholder">
          No verses found for {bookName} {chapter}. Has the scripture data been imported yet?
        </p>
      )}

      <div className="passage">
        <h1>
          {bookName} {chapter}
        </h1>
        {verses.map((v) => {
          const color = colorByVerse[v.verse_id]
          return (
            <p
              key={v.verse_id}
              className={`verse${color ? ` highlight-${color}` : ''}`}
              onClick={() => setSelectedVerse(v)}
            >
              <span className="verse-num">{v.verse}</span>
              {v.text}
              {notesByVerse[v.verse_id]?.length > 0 && (
                <span className="verse-note-dot" title="Has a note" />
              )}
              {excerptsByVerse[v.verse_id]?.length > 0 && (
                <span className="verse-journal-dot" title="Mentioned in journal" />
              )}
            </p>
          )
        })}
      </div>
    </div>
  )
}
