import { BOOKS } from '../reading/books'

export interface ParsedTag {
  match: string
  start: number
  end: number
  book: string
  chapter: number
  // Sorted, deduplicated verse numbers this tag covers — length 1 for a
  // plain single-verse tag, more for a range or a comma/&-separated list
  // that may itself mix ranges and singles, e.g. "1-4,5&7".
  verseNumbers: number[]
  verseIds: string[]
}

// @<book> <chapter>:<verse-list> — book may be a full name ("Psalms"), a
// USFM code ("PSA"), or any prefix of the full name ("Ps", "Gen"). Leading
// "1"/"2"/"3" handles books like "1 Corinthians" / "1Cor". <verse-list> is
// one or more verse numbers or ranges, separated by "," and/or "&" — e.g.
// "19-20", "19&20", "1,3&5", or "1-4,5&7".
const VERSE_TOKEN = String.raw`\d+(?:-\d+)?`
const TAG_PATTERN = new RegExp(
  String.raw`@([1-3]?\s?[A-Za-z]+)\.?\s+(\d+):(${VERSE_TOKEN}(?:\s*[,&]\s*${VERSE_TOKEN})*)`,
  'g',
)

// Guards against a stray "-2026" or a huge pasted list silently exploding
// into hundreds of tagged verses — collapses back to just the first verse
// if the expanded list would be larger than this.
const MAX_VERSES = 50

function resolveBook(raw: string): string | null {
  const normalized = raw.replace(/\s+/g, '').toLowerCase()
  const byCode = BOOKS.find((b) => b.code.toLowerCase() === normalized)
  if (byCode) return byCode.code
  const byName = BOOKS.find((b) => b.name.replace(/\s+/g, '').toLowerCase() === normalized)
  if (byName) return byName.code
  const byPrefix = BOOKS.find((b) =>
    b.name.replace(/\s+/g, '').toLowerCase().startsWith(normalized),
  )
  return byPrefix?.code ?? null
}

// "1-4,5&7" -> [1,2,3,4,5,7]. Each comma/&-separated token is either a
// single verse number or an "N-M" range; ranges expand, everything dedupes
// and sorts ascending so overlaps ("1-4,3&5") collapse cleanly.
function expandVerseList(raw: string): number[] {
  const numbers = new Set<number>()
  for (const token of raw.split(/[,&]/)) {
    const trimmed = token.trim()
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10)
      const end = Number.parseInt(rangeMatch[2], 10)
      if (end >= start) {
        for (let v = start; v <= end; v++) numbers.add(v)
      } else {
        numbers.add(start)
      }
    } else {
      const single = Number.parseInt(trimmed, 10)
      if (!Number.isNaN(single)) numbers.add(single)
    }
  }
  return [...numbers].sort((a, b) => a - b)
}

// "1-5, 7" style compact display for a sorted verse-number list — used by
// VerseTagChip so the chip always shows a clean canonical range/list
// regardless of how the user typed it (mixed "," and "&", out of order,
// overlapping ranges, etc).
export function formatVerseRanges(sortedNumbers: number[]): string {
  const parts: string[] = []
  let i = 0
  while (i < sortedNumbers.length) {
    let j = i
    while (j + 1 < sortedNumbers.length && sortedNumbers[j + 1] === sortedNumbers[j] + 1) j++
    parts.push(i === j ? `${sortedNumbers[i]}` : `${sortedNumbers[i]}-${sortedNumbers[j]}`)
    i = j + 1
  }
  return parts.join(', ')
}

export function parseVerseTags(text: string): ParsedTag[] {
  const tags: ParsedTag[] = []
  for (const m of text.matchAll(TAG_PATTERN)) {
    const [full, bookRaw, chapterRaw, verseListRaw] = m
    const code = resolveBook(bookRaw)
    if (!code || m.index === undefined) continue
    const chapter = Number.parseInt(chapterRaw, 10)
    let verseNumbers = expandVerseList(verseListRaw)
    if (verseNumbers.length === 0) continue
    if (verseNumbers.length > MAX_VERSES) verseNumbers = [verseNumbers[0]]

    tags.push({
      match: full,
      start: m.index,
      end: m.index + full.length,
      book: code,
      chapter,
      verseNumbers,
      verseIds: verseNumbers.map((v) => `${code}.${chapter}.${v}`),
    })
  }
  return tags
}
