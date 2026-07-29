import { parseVerseId } from './books'
import type { Entry } from '../../types/db'

// Shared by every surface that shows a written entry outside the reading
// view (Journal, Prayer history, Highlights artifacts, Calendar Day view)
// and offers to send it back there for editing in Notebook mode. Landing
// at the entry's own anchored passage when it has one (a reflection or a
// highlight-tagged note) makes more sense than dropping the user wherever
// the reading view last happened to be; entries with no anchor (plain
// journal entries, prayer writing) just open Notebook without moving the
// passage.
export function notebookHref(entry: Entry): string {
  if (entry.anchor_start) {
    const { book, chapter } = parseVerseId(entry.anchor_start)
    return `/?book=${book}&chapter=${chapter}&notebook=${entry.id}`
  }
  return `/?notebook=${entry.id}`
}
