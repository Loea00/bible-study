import { parseVerseId } from './books'
import { parseVerseTags } from '../journal/verseTagParser'
import type { Entry } from '../../types/db'

// Shared by every surface that shows a written entry outside the reading
// view (Journal, Prayer history, Highlights artifacts, Calendar Day view)
// and offers to send it back there for editing in Notebook mode. Landing
// at the entry's own referenced passage makes more sense than dropping the
// user wherever the reading view last happened to be -- checks
// anchor_start first (a reflection or a highlight-tagged note's actual
// anchor), then falls back to the first inline @verse tag in the body
// (plain journal entries have no anchor_start at all, but very often
// mention a passage by tag). Entries with neither just open Notebook
// without moving the passage.
export function notebookHref(entry: Entry): string {
  if (entry.anchor_start) {
    const { book, chapter } = parseVerseId(entry.anchor_start)
    return `/?book=${book}&chapter=${chapter}&notebook=${entry.id}`
  }
  const firstTag = parseVerseTags(entry.body)[0]
  if (firstTag) {
    return `/?book=${firstTag.book}&chapter=${firstTag.chapter}&notebook=${entry.id}`
  }
  return `/?notebook=${entry.id}`
}
