import { useState } from 'react'
import { useVerses } from './useVerses'
import { PassagePicker } from './PassagePicker'
import { BOOK_BY_CODE } from './books'

const TRANSLATIONS = ['KJV', 'ASV']

export function ReadingView() {
  const [book, setBook] = useState('GEN')
  const [chapter, setChapter] = useState(1)
  const [translation, setTranslation] = useState('KJV')
  const [pickerOpen, setPickerOpen] = useState(false)

  const { verses, loading, error } = useVerses(book, chapter, translation)
  const bookName = BOOK_BY_CODE[book]?.name ?? book

  function handleSelect(newBook: string, newChapter: number) {
    setBook(newBook)
    setChapter(newChapter)
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
        {verses.map((v) => (
          <p key={v.verse_id} className="verse">
            <span className="verse-num">{v.verse}</span>
            {v.text}
          </p>
        ))}
      </div>
    </div>
  )
}
