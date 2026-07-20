import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVerses } from './useVerses'
import { useMarginNotes } from './useMarginNotes'
import { useHighlights } from './useHighlights'
import { useJournalExcerpts } from './useJournalExcerpts'
import { useCrossReferences } from './useCrossReferences'
import { useCommentary } from './useCommentary'
import { useReadingSession } from './useReadingSession'
import { useWordTags } from './useWordTags'
import { PassagePicker } from './PassagePicker'
import { VersePanel } from './VersePanel'
import { HighlightGroupPanel } from './HighlightGroupPanel'
import { ReflectionComposer } from './ReflectionComposer'
import { VerseText } from './VerseText'
import { NoteIcon, ReflectionIcon, JournalIcon } from './VerseIndicatorIcons'
import { LexiconCard } from './LexiconCard'
import { SelectionActionBar } from './SelectionActionBar'
import { PendingGroupBar } from './PendingGroupBar'
import { NoteComposer } from './NoteComposer'
import { useReflections } from './useReflections'
import { usePrayerRequestTitles } from '../prayer/usePrayerRequestTitles'
import { getSelectionSpans, getSelectionBoundingRect, clearSelection, type SelectionSpan } from './selection'
import { BOOK_BY_CODE, formatReference } from './books'
import type { Verse, HighlightColor } from '../../types/db'

const TRANSLATIONS = ['KJV', 'ASV']

// The docked side panel shows exactly one of these at a time. Lexicon stays
// entirely separate (selectedWord below) — it's a floating overlay, not
// part of the dock, so word-tap keeps working no matter what's docked.
type SidePanelState =
  | { mode: 'verse'; verse: Verse }
  | { mode: 'highlight'; highlightId: string }
  | { mode: 'reflection'; spans: SelectionSpan[] }
  | null

function formatSpansLabel(spans: SelectionSpan[]): string {
  if (spans.length === 0) return ''
  const first = formatReference(spans[0].verseId)
  const last = formatReference(spans[spans.length - 1].verseId)
  return first === last ? first : `${first} – ${last}`
}

export function ReadingView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const book = searchParams.get('book') ?? 'GEN'
  const chapter = Number.parseInt(searchParams.get('chapter') ?? '1', 10) || 1
  const targetVerse = searchParams.get('verse')
  const targetVerseRef = useRef<HTMLParagraphElement>(null)
  const [translation, setTranslation] = useState('KJV')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sidePanel, setSidePanel] = useState<SidePanelState>(null)
  const [selectedWord, setSelectedWord] = useState<string[] | null>(null)
  const [activeSelection, setActiveSelection] = useState<{
    spans: SelectionSpan[]
    rect: DOMRect
    text: string
  } | null>(null)
  const [pendingGroup, setPendingGroup] = useState<SelectionSpan[]>([])
  const [noteSpans, setNoteSpans] = useState<SelectionSpan[] | null>(null)
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)

  const { verses, loading, error } = useVerses(book, chapter, translation)
  const { notesByVerse, addNote, updateNote, deleteNote } = useMarginNotes(book, chapter)
  const {
    highlightsByVerse,
    createHighlight,
    updateHighlight,
    removeHighlight,
    getHighlightSpans,
    getHighlight,
  } = useHighlights(book, chapter, translation)
  const { excerptsByVerse } = useJournalExcerpts(book, chapter)
  const { crossReferencesByVerse } = useCrossReferences(book, chapter)
  const { commentaryByVerse } = useCommentary(book, chapter)
  const { reflectionsByVerse, addReflection } = useReflections(book, chapter)
  const requestTitleById = usePrayerRequestTitles()
  const tagsByVerse = useWordTags(book, chapter, translation)
  useReadingSession(book, chapter)
  const bookName = BOOK_BY_CODE[book]?.name ?? book
  const versesById = Object.fromEntries(verses.map((v) => [v.verse_id, v]))
  const versesByIdRef = useRef(versesById)
  versesByIdRef.current = versesById

  // Landing from a cross-reference/deep link (?verse=N): scroll to it and
  // open the docked panel for it, replacing whatever was showing before —
  // otherwise the panel keeps pointing at the verse you navigated *from*,
  // which is now in a different chapter and shows nothing.
  useEffect(() => {
    if (!targetVerse) return
    const v = versesById[`${book}.${chapter}.${targetVerse}`]
    if (!v) return
    setSidePanel({ mode: 'verse', verse: v })
    // Deferred: right after a route change the browser hasn't settled layout
    // yet, and scrollIntoView computed against a not-yet-laid-out viewport
    // can land wildly off target. setTimeout over requestAnimationFrame since
    // rAF doesn't fire at all in a backgrounded tab.
    setTimeout(() => {
      targetVerseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }, [book, chapter, targetVerse, verses.length])

  function handleSelect(newBook: string, newChapter: number) {
    setSearchParams({ book: newBook, chapter: String(newChapter) })
    setPickerOpen(false)
  }

  // Driven by `selectionchange`, not `mouseup`: on iOS Safari, finishing a
  // drag-selection (via the native handle UI) doesn't reliably fire mouseup
  // on the underlying text — the finger lifts off a system-drawn handle, not
  // a DOM node. `selectionchange` fires regardless of input device, so this
  // is the one mechanism that captures both mouse and touch selections.
  // Debounced because it also fires on every intermediate step while
  // dragging a handle, not just on release.
  useEffect(() => {
    let timeoutId: number | undefined

    function handleSelectionChange() {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        const spans = getSelectionSpans()
        if (spans.length === 0) return
        const rect = getSelectionBoundingRect()
        if (!rect) return
        const text = spans
          .map((s) => versesByIdRef.current[s.verseId]?.text.slice(s.startOffset, s.endOffset) ?? '')
          .join(' ')
        setActiveSelection({ spans, rect, text })
      }, 200)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

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
    setEditingHighlightId(null)
  }

  // Reuses the +Add pending-group machinery for editing: loading an
  // existing highlight's spans into `pendingGroup` lets the same "select
  // more, then commit" flow extend it, instead of building a separate
  // editing UI. Shrinking/removing individual spans isn't supported this
  // way — only growing — which matches what was actually asked for.
  function startEditHighlight(highlightId: string) {
    const spans = getHighlightSpans(highlightId)
    if (spans.length === 0) return
    setPendingGroup(spans)
    setEditingHighlightId(highlightId)
    setSidePanel(null)
  }

  // Notes anchor to the highlight's exact span group (spec's "sum of the
  // parts") — reuses the same addNote(spans, ...) the selection flow uses,
  // just fed from an existing highlight's spans instead of a fresh
  // selection, so one note can cover the same non-consecutive text.
  function openNoteFromHighlight(highlightId: string) {
    const spans = getHighlightSpans(highlightId)
    if (spans.length === 0) return
    setNoteSpans(spans)
    setSidePanel(null)
  }

  function openReflectionFromHighlight(highlightId: string) {
    const spans = getHighlightSpans(highlightId)
    if (spans.length === 0) return
    setSidePanel({ mode: 'reflection', spans })
  }

  async function handleRemoveHighlightGroup(highlightId: string) {
    await removeHighlight(highlightId)
    setSidePanel(null)
  }

  async function handleHighlightSelection(color: HighlightColor) {
    if (!activeSelection) return
    const spans = [...pendingGroup, ...activeSelection.spans]
    if (editingHighlightId) {
      await updateHighlight(editingHighlightId, spans, color)
    } else {
      await createHighlight(spans, color)
    }
    clearPendingGroup()
    closeSelection()
  }

  async function handleHighlightPending(color: HighlightColor) {
    if (pendingGroup.length === 0) return
    if (editingHighlightId) {
      await updateHighlight(editingHighlightId, pendingGroup, color)
    } else {
      await createHighlight(pendingGroup, color)
    }
    clearPendingGroup()
  }

  function openNoteFromSelection() {
    if (!activeSelection) return
    setNoteSpans([...pendingGroup, ...activeSelection.spans])
  }

  // Spec §5.3: "select passage → Reflect" — anchors automatically to
  // whatever's currently selected (folding in any +Add group too, same as
  // Note), no manual tagging needed. Doesn't clear pendingGroup here —
  // matches Note's behavior of preserving the group if the composer is
  // closed without saving, so the user can retry.
  function openReflectionFromSelection() {
    if (!activeSelection) return
    setSidePanel({ mode: 'reflection', spans: [...pendingGroup, ...activeSelection.spans] })
    closeSelection()
  }

  function openNoteFromPending() {
    if (pendingGroup.length === 0) return
    setNoteSpans(pendingGroup)
  }

  function openReflectionFromPending() {
    if (pendingGroup.length === 0) return
    setSidePanel({ mode: 'reflection', spans: pendingGroup })
  }

  async function handleSaveNote(body: string) {
    if (!noteSpans) return
    await addNote(noteSpans, body, translation)
    setNoteSpans(null)
    clearPendingGroup()
    closeSelection()
  }

  async function handleSaveReflection(title: string, body: string) {
    if (sidePanel?.mode !== 'reflection') return
    await addReflection(sidePanel.spans, title, body, translation)
    setSidePanel(null)
    clearPendingGroup()
  }

  function openVerseView(v: Verse) {
    setSidePanel({ mode: 'verse', verse: v })
  }

  // "Refs" (action bar): opens the docked panel for whichever verse the
  // active selection starts in — cross-references are per-verse, unlike
  // Note/Reflect which can span the whole selection.
  function handleRefsFromSelection() {
    if (!activeSelection) return
    const v = versesById[activeSelection.spans[0].verseId]
    if (v) openVerseView(v)
    closeSelection()
  }

  const pendingByVerse: Record<string, SelectionSpan[]> = {}
  for (const span of pendingGroup) {
    ;(pendingByVerse[span.verseId] ??= []).push(span)
  }

  // One dot per distinct highlight group touching this verse (a group can
  // touch several verses, and a verse can carry more than one group) — the
  // dedicated, always-reachable entry point into highlight management, now
  // that the highlighted text itself is reserved for word-tap.
  const highlightGroupsByVerse: Record<string, { id: string; color: HighlightColor }[]> = {}
  for (const [verseId, list] of Object.entries(highlightsByVerse)) {
    const seen = new Map<string, HighlightColor>()
    for (const h of list) seen.set(h.id, h.color)
    highlightGroupsByVerse[verseId] = [...seen.entries()].map(([id, color]) => ({ id, color }))
  }

  const openHighlight = sidePanel?.mode === 'highlight' ? getHighlight(sidePanel.highlightId) : undefined

  return (
    <div className="reading-view">
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
          onReflect={openReflectionFromSelection}
          onRefs={handleRefsFromSelection}
          onAddToGroup={handleAddToGroup}
          onClose={closeSelection}
        />
      )}

      {pendingGroup.length > 0 && !activeSelection && !noteSpans && (
        <PendingGroupBar
          count={pendingGroup.length}
          editing={editingHighlightId !== null}
          onHighlight={handleHighlightPending}
          onNote={openNoteFromPending}
          onReflect={openReflectionFromPending}
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

      <div className="reading-pane">
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
            <p
              key={v.verse_id}
              className={String(v.verse) === targetVerse ? 'verse verse-target' : 'verse'}
              ref={String(v.verse) === targetVerse ? targetVerseRef : undefined}
            >
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
              />
              {notesByVerse[v.verse_id]?.length > 0 && (
                <span
                  className="verse-icon verse-note-icon"
                  title="Has a note"
                  onClick={(e) => {
                    e.stopPropagation()
                    openVerseView(v)
                  }}
                >
                  <NoteIcon />
                </span>
              )}
              {reflectionsByVerse[v.verse_id]?.length > 0 && (
                <span
                  className="verse-icon verse-reflection-icon"
                  title="Has a reflection"
                  onClick={(e) => {
                    e.stopPropagation()
                    openVerseView(v)
                  }}
                >
                  <ReflectionIcon />
                </span>
              )}
              {excerptsByVerse[v.verse_id]?.length > 0 && (
                <span
                  className="verse-icon verse-journal-icon"
                  title="Mentioned in journal"
                  onClick={(e) => {
                    e.stopPropagation()
                    openVerseView(v)
                  }}
                >
                  <JournalIcon />
                </span>
              )}
              {highlightGroupsByVerse[v.verse_id]?.map((h) => (
                <span
                  key={h.id}
                  className={`verse-highlight-dot verse-highlight-dot-${h.color}`}
                  title="Highlighted"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSidePanel({ mode: 'highlight', highlightId: h.id })
                  }}
                />
              ))}
            </p>
          ))}
        </div>
      </div>

      <div className={`reading-side-panel${sidePanel ? ' open' : ''}`}>
        {sidePanel?.mode === 'verse' && (
          <VersePanel
            verseText={sidePanel.verse.text}
            reference={`${bookName} ${sidePanel.verse.chapter}:${sidePanel.verse.verse}`}
            notes={notesByVerse[sidePanel.verse.verse_id] ?? []}
            journalExcerpts={excerptsByVerse[sidePanel.verse.verse_id] ?? []}
            reflections={reflectionsByVerse[sidePanel.verse.verse_id] ?? []}
            crossReferences={crossReferencesByVerse[sidePanel.verse.verse_id] ?? []}
            commentary={commentaryByVerse[sidePanel.verse.verse_id] ?? []}
            requestTitleById={requestTitleById}
            onEditNote={updateNote}
            onDeleteNote={deleteNote}
            onClose={() => setSidePanel(null)}
          />
        )}

        {sidePanel?.mode === 'highlight' && openHighlight && (
          <HighlightGroupPanel
            highlight={openHighlight}
            translation={translation}
            onExtend={() => startEditHighlight(openHighlight.id)}
            onNote={() => openNoteFromHighlight(openHighlight.id)}
            onReflect={() => openReflectionFromHighlight(openHighlight.id)}
            onRemove={() => handleRemoveHighlightGroup(openHighlight.id)}
            onClose={() => setSidePanel(null)}
          />
        )}

        {sidePanel?.mode === 'reflection' && (
          <ReflectionComposer
            passageLabel={formatSpansLabel(sidePanel.spans)}
            onSave={handleSaveReflection}
            onClose={() => setSidePanel(null)}
          />
        )}
      </div>
    </div>
  )
}
