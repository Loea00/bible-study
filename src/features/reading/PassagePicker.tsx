import { useState } from 'react'
import { BOOKS, BOOK_BY_CODE } from './books'
import { useChapterCount } from './useChapterCount'

interface PassagePickerProps {
  translation: string
  onSelect: (book: string, chapter: number) => void
  onClose: () => void
}

export function PassagePicker({ translation, onSelect, onClose }: PassagePickerProps) {
  const [pickingBook, setPickingBook] = useState<string | null>(null)
  const chapterCount = useChapterCount(pickingBook, translation)

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        {!pickingBook ? (
          <>
            <h2>Old Testament</h2>
            <div className="picker-grid">
              {BOOKS.filter((b) => b.testament === 'OT').map((b) => (
                <button key={b.code} type="button" onClick={() => setPickingBook(b.code)}>
                  {b.name}
                </button>
              ))}
            </div>
            <h2>New Testament</h2>
            <div className="picker-grid">
              {BOOKS.filter((b) => b.testament === 'NT').map((b) => (
                <button key={b.code} type="button" onClick={() => setPickingBook(b.code)}>
                  {b.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="picker-header">
              <button type="button" className="picker-back" onClick={() => setPickingBook(null)}>
                ← Books
              </button>
              <h2>{BOOK_BY_CODE[pickingBook]?.name}</h2>
            </div>
            {chapterCount == null ? (
              <p className="placeholder">Loading chapters…</p>
            ) : (
              <div className="picker-grid picker-grid-chapters">
                {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => onSelect(pickingBook, n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
