import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVerses } from './useVerses'
import { useMarginNotes } from './useMarginNotes'
import { useHighlights } from './useHighlights'
import { useJournalExcerpts } from './useJournalExcerpts'
import { useReadingSession } from './useReadingSession'
import { useWordTags } from './useWordTags'
import { PassagePicker } from './PassagePicker'
import { VersePanel } from './VersePanel'
import { VerseText } from './VerseText'
import { LexiconCard } from './LexiconCard'
import { SelectionActionBar } from './SelectionActionBar'
import { PendingGroupBar } from './PendingGroupBar'
import { NoteComposer } from './NoteComposer'
import { getSelectionSpans, getSelectionBoundingRect, clearSelection, type SelectionSpan } from './selection'
import { BOOK_BY_CODE } from './books'
import type { Verse, HighlightColor } from '../../types/db'

const TRANSLATIONS = ['KJV', 'ASV']

export function ReadingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const book = searchParams.get('book') ?? 'GEN'
  const chapter = Number.parseInt(searchParams.get('chapter') ?? '1', 10) || 1
  const [translation, setTranslation] = useState('KJV')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null)
  const [selectedWord, setSelectedWord] = useState<string[] | null>(null)
  const [activeSelection, setActiveSelection] = useState<{
    spans: SelectionSpan[]
    rect: DOMRect
    text: string
  } | null>(null)
  const [pendingGroup, setPendingGroup] = useState<SelectionSpan[]>([])
  const [noteSpans, setNoteSpans] = useState<SelectionSpan[] | null>(null)

  const { verses, loading, error } = useVerses(book, chapter, translation)
  const { notesByVerse, addNote, deleteNote } = useMarginNotes(book, chapter)
  const { highlightsByVerse, createHighlight, removeHighlight } = useHighlights(book, chapter, translation)
  const { excerptsByVerse } = useJournalExcerpts(book, chapter)
  const tagsByVerse = useWordTags(book, chapter, translation)
  useReadingSession(book, chapter)
  const bookName = BOOK_BY_CODE[book]?.name ?? book
  const versesById = Object.fromEntries(verses.map((v) => [v.verse_id, v]))

  function handleSelect(newBook: string, newChapter: number) {
    setSearchParams({ book: newBook, chapter: String(newChapter) })
    setPickerOpen(false)
  }

  function handleMouseUp() {
    const spans = getSelectionSpans()
    if (spans.length === 0) return
    const rect = getSelectionBoundingRect()
    if (!rect) return
    const text = spans
      .map((s) => versesById[s.verseId]?.text.slice(s.startOffset, s.endOffset) ?? '')
      .join(' ')
    setActiveSelection({ spans, rect, text })
  }

  function handleVerseNumberTap(v: Verse, e: React.MouseEvent) {
    const target = e.currentTarget.closest('.verse') as HTMLElement | null
    const rect = (target ?? e.currentTarget).getBoundingClientRect()
    setActiveSelection({
      spans: [{ verseId: v.verse_id, startOffset: 0, endOffset: v.text.length }],
      rect,
      text: v.text,
    })
  }

  function closeSelection() {
    clearSelection()
    setActiveSelection(null)
  }

  // "+ Add" (spec amendment v1.1 §A9): hold the current selection in a
  // provisional group instead of committing it, so the next selection can
  // join it — the designed way to mark non-consecutive text as one
  // highlight/note, since no native gesture does this.
  function handleAddToGroup() {
    if (!activeSelection) return
    setPendingGroup((prev) => [...prev, ...activeSelection.spans])
    closeSelection()
  }

  function clearPendingGroup() {
    setPendingGroup([])
  }

  async function handleHighlightSelection(color: HighlightColor) {
    if (!activeSelection) return
    const spans = [...pendingGroup, ...activeSelection.spans]
    await createHighlight(spans, color)
    clearPendingGroup()
    closeSelection()
  }

  async function handleHighlightPending(color: HighlightColor) {
    if (pendingGroup.length === 0) return
    await createHighlight(pendingGroup, color)
    clearPendingGroup()
  }

  function openNoteFromSelection() {
    if (!activeSelection) return
    setNoteSpans([...pendingGroup, ...activeSelection.spans])
  }

  function openNoteFromPending() {
    if (pendingGroup.length === 0) return
    setNoteSpans(pendingGroup)
  }

  async function handleSaveNote(body: string) {
    if (!noteSpans) return
    await addNote(noteSpans, body, translation)
    setNoteSpans(null)
    clearPendingGroup()
    closeSelection()
  }

  function openVerseView(v: Verse) {
    setSelectedVerse(v)
  }

  const panelHighlights = selectedVerse
    ? Array.from(
        new Map(
          (highlightsByVerse[selectedVerse.verse_id] ?? []).map((h) => [h.id, { id: h.id, color: h.color }]),
        ).values(),
      )
    : []

  const pendingByVerse: Record<string, SelectionSpan[]> = {}
  for (const span of pendingGroup) {
    ;(pendingByVerse[span.verseId] ??= []).push(span)
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

      {selectedWord && (
        <LexiconCard strongsIds={selectedWord} onClose={() => setSelectedWord(null)} />
      )}

      {activeSelection && !noteSpans && (
        <SelectionActionBar
          rect={activeSelection.rect}
          selectedText={activeSelection.text}
          groupCount={pendingGroup.length}
          onHighlight={handleHighlightSelection}
          onNote={openNoteFromSelection}
          onAddToGroup={handleAddToGroup}
          onClose={closeSelection}
        />
      )}

      {pendingGroup.length > 0 && !activeSelection && !noteSpans && (
        <PendingGroupBar
          count={pendingGroup.length}
          onHighlight={handleHighlightPending}
          onNote={openNoteFromPending}
          onClear={clearPendingGroup}
        />
      )}

      {noteSpans && (
        <NoteComposer
          onSave={handleSaveNote}
          onClose={() => {
            setNoteSpans(null)
            closeSelection()
          }}
        />
      )}

      {selectedVerse && (
        <VersePanel
          verseText={selectedVerse.text}
          reference={`${bookName} ${selectedVerse.chapter}:${selectedVerse.verse}`}
          notes={notesByVerse[selectedVerse.verse_id] ?? []}
          journalExcerpts={excerptsByVerse[selectedVerse.verse_id] ?? []}
          highlights={panelHighlights}
          onDeleteNote={(entryId) => deleteNote(selectedVerse.verse_id, entryId)}
          onRemoveHighlight={removeHighlight}
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

      <div className="passage" onMouseUp={handleMouseUp}>
        <h1>
          {bookName} {chapter}
        </h1>
        {verses.map((v) => (
          <p key={v.verse_id} className="verse">
            <span className="verse-num" onClick={(e) => handleVerseNumberTap(v, e)}>
              {v.verse}
            </span>
            <VerseText
              verseId={v.verse_id}
              text={v.text}
              tags={tagsByVerse[v.verse_id] ?? []}
              highlights={highlightsByVerse[v.verse_id] ?? []}
              pending={pendingByVerse[v.verse_id] ?? []}
              onWordTap={setSelectedWord}
              onHighlightTap={() => openVerseView(v)}
            />
            {notesByVerse[v.verse_id]?.length > 0 && (
              <span
                className="verse-note-dot"
                title="Has a note"
                onClick={(e) => {
                  e.stopPropagation()
                  openVerseView(v)
                }}
              />
            )}
            {excerptsByVerse[v.verse_id]?.length > 0 && (
              <span
                className="verse-journal-dot"
                title="Mentioned in journal"
                onClick={(e) => {
                  e.stopPropagation()
                  openVerseView(v)
                }}
              />
            )}
          </p>
        ))}
      </div>
    </div>
  )
}
