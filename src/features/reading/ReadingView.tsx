import { useState, type FormEvent } from 'react'
import { useVerses } from './useVerses'

const TRANSLATIONS = ['KJV', 'ASV']

export function ReadingView() {
  const [book, setBook] = useState('PSA')
  const [chapter, setChapter] = useState(46)
  const [translation, setTranslation] = useState('KJV')
  const [bookInput, setBookInput] = useState('PSA')
  const [chapterInput, setChapterInput] = useState('46')

  const { verses, loading, error } = useVerses(book, chapter, translation)

  function handleGo(e: FormEvent) {
    e.preventDefault()
    const chapterNum = Number.parseInt(chapterInput, 10)
    if (!bookInput.trim() || Number.isNaN(chapterNum) || chapterNum < 1) return
    setBook(bookInput.trim().toUpperCase())
    setChapter(chapterNum)
  }

  return (
    <div className="reading-view">
      <form className="reading-controls" onSubmit={handleGo}>
        <input
          value={bookInput}
          onChange={(e) => setBookInput(e.target.value)}
          placeholder="PSA"
          aria-label="Book"
          size={5}
        />
        <input
          value={chapterInput}
          onChange={(e) => setChapterInput(e.target.value)}
          placeholder="46"
          aria-label="Chapter"
          type="number"
          min={1}
          size={3}
        />
        <button type="submit">Go</button>
        <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
          {TRANSLATIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </form>

      {loading && <p className="placeholder">Loading…</p>}
      {error && <p className="placeholder">Couldn't load this passage: {error}</p>}
      {!loading && !error && verses.length === 0 && (
        <p className="placeholder">
          No verses found for {book} {chapter}. Has the scripture data been imported yet?
        </p>
      )}

      <div className="passage">
        <h1>
          {book} {chapter}
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
