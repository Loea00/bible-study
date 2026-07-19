export interface BookInfo {
  code: string
  name: string
  testament: 'OT' | 'NT'
}

// Canonical order, matching the USFM codes used as verse_id prefixes
// (scripts/transform_kjv.py has the source-name mapping this mirrors).
export const BOOKS: BookInfo[] = [
  { code: 'GEN', name: 'Genesis', testament: 'OT' },
  { code: 'EXO', name: 'Exodus', testament: 'OT' },
  { code: 'LEV', name: 'Leviticus', testament: 'OT' },
  { code: 'NUM', name: 'Numbers', testament: 'OT' },
  { code: 'DEU', name: 'Deuteronomy', testament: 'OT' },
  { code: 'JOS', name: 'Joshua', testament: 'OT' },
  { code: 'JDG', name: 'Judges', testament: 'OT' },
  { code: 'RUT', name: 'Ruth', testament: 'OT' },
  { code: '1SA', name: '1 Samuel', testament: 'OT' },
  { code: '2SA', name: '2 Samuel', testament: 'OT' },
  { code: '1KI', name: '1 Kings', testament: 'OT' },
  { code: '2KI', name: '2 Kings', testament: 'OT' },
  { code: '1CH', name: '1 Chronicles', testament: 'OT' },
  { code: '2CH', name: '2 Chronicles', testament: 'OT' },
  { code: 'EZR', name: 'Ezra', testament: 'OT' },
  { code: 'NEH', name: 'Nehemiah', testament: 'OT' },
  { code: 'EST', name: 'Esther', testament: 'OT' },
  { code: 'JOB', name: 'Job', testament: 'OT' },
  { code: 'PSA', name: 'Psalms', testament: 'OT' },
  { code: 'PRO', name: 'Proverbs', testament: 'OT' },
  { code: 'ECC', name: 'Ecclesiastes', testament: 'OT' },
  { code: 'SNG', name: 'Song of Solomon', testament: 'OT' },
  { code: 'ISA', name: 'Isaiah', testament: 'OT' },
  { code: 'JER', name: 'Jeremiah', testament: 'OT' },
  { code: 'LAM', name: 'Lamentations', testament: 'OT' },
  { code: 'EZK', name: 'Ezekiel', testament: 'OT' },
  { code: 'DAN', name: 'Daniel', testament: 'OT' },
  { code: 'HOS', name: 'Hosea', testament: 'OT' },
  { code: 'JOL', name: 'Joel', testament: 'OT' },
  { code: 'AMO', name: 'Amos', testament: 'OT' },
  { code: 'OBA', name: 'Obadiah', testament: 'OT' },
  { code: 'JON', name: 'Jonah', testament: 'OT' },
  { code: 'MIC', name: 'Micah', testament: 'OT' },
  { code: 'NAM', name: 'Nahum', testament: 'OT' },
  { code: 'HAB', name: 'Habakkuk', testament: 'OT' },
  { code: 'ZEP', name: 'Zephaniah', testament: 'OT' },
  { code: 'HAG', name: 'Haggai', testament: 'OT' },
  { code: 'ZEC', name: 'Zechariah', testament: 'OT' },
  { code: 'MAL', name: 'Malachi', testament: 'OT' },
  { code: 'MAT', name: 'Matthew', testament: 'NT' },
  { code: 'MRK', name: 'Mark', testament: 'NT' },
  { code: 'LUK', name: 'Luke', testament: 'NT' },
  { code: 'JHN', name: 'John', testament: 'NT' },
  { code: 'ACT', name: 'Acts', testament: 'NT' },
  { code: 'ROM', name: 'Romans', testament: 'NT' },
  { code: '1CO', name: '1 Corinthians', testament: 'NT' },
  { code: '2CO', name: '2 Corinthians', testament: 'NT' },
  { code: 'GAL', name: 'Galatians', testament: 'NT' },
  { code: 'EPH', name: 'Ephesians', testament: 'NT' },
  { code: 'PHP', name: 'Philippians', testament: 'NT' },
  { code: 'COL', name: 'Colossians', testament: 'NT' },
  { code: '1TH', name: '1 Thessalonians', testament: 'NT' },
  { code: '2TH', name: '2 Thessalonians', testament: 'NT' },
  { code: '1TI', name: '1 Timothy', testament: 'NT' },
  { code: '2TI', name: '2 Timothy', testament: 'NT' },
  { code: 'TIT', name: 'Titus', testament: 'NT' },
  { code: 'PHM', name: 'Philemon', testament: 'NT' },
  { code: 'HEB', name: 'Hebrews', testament: 'NT' },
  { code: 'JAS', name: 'James', testament: 'NT' },
  { code: '1PE', name: '1 Peter', testament: 'NT' },
  { code: '2PE', name: '2 Peter', testament: 'NT' },
  { code: '1JN', name: '1 John', testament: 'NT' },
  { code: '2JN', name: '2 John', testament: 'NT' },
  { code: '3JN', name: '3 John', testament: 'NT' },
  { code: 'JUD', name: 'Jude', testament: 'NT' },
  { code: 'REV', name: 'Revelation', testament: 'NT' },
]

export const BOOK_BY_CODE: Record<string, BookInfo> = Object.fromEntries(
  BOOKS.map((b) => [b.code, b]),
)

export function parseVerseId(verseId: string) {
  const [book, chapter, verse] = verseId.split('.')
  return { book, chapter: Number(chapter), verse: Number(verse) }
}

export function formatReference(verseId: string): string {
  const { book, chapter, verse } = parseVerseId(verseId)
  const name = BOOK_BY_CODE[book]?.name ?? book
  return `${name} ${chapter}:${verse}`
}

// For a TSK-style (start, end) target pair — collapses to a single
// reference when start === end, otherwise a range, shortened when the
// range shares a book/chapter with its start (e.g. "Genesis 1:1-3").
export function formatReferenceRange(startId: string, endId: string): string {
  if (startId === endId) return formatReference(startId)
  const start = parseVerseId(startId)
  const end = parseVerseId(endId)
  const startRef = formatReference(startId)
  if (start.book === end.book && start.chapter === end.chapter) {
    return `${startRef}-${end.verse}`
  }
  if (start.book === end.book) {
    return `${startRef}-${end.chapter}:${end.verse}`
  }
  return `${startRef}-${formatReference(endId)}`
}

const BOOK_ORDER = new Map(BOOKS.map((b, i) => [b.code, i]))

// Canonical Bible order, not lexicographic — "GEN.1.10" must sort after
// "GEN.1.2", which plain string comparison gets wrong.
export function compareVerseIds(a: string, b: string): number {
  const pa = parseVerseId(a)
  const pb = parseVerseId(b)
  const bookDiff = (BOOK_ORDER.get(pa.book) ?? 0) - (BOOK_ORDER.get(pb.book) ?? 0)
  if (bookDiff !== 0) return bookDiff
  if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter
  return pa.verse - pb.verse
}
