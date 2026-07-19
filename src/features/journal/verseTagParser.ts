import { BOOKS } from '../reading/books'

export interface ParsedTag {
  match: string
  start: number
  end: number
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  // One id per verse covered, in order — length 1 for a plain single-verse
  // tag, length 2+ for a range like "19-20" or "19&20".
  verseIds: string[]
}

// @<book> <chapter>:<verse>[-<verse>|&<verse>] — book may be a full name
// ("Psalms"), a USFM code ("PSA"), or any prefix of the full name ("Ps",
// "Gen"). Leading "1"/"2"/"3" handles books like "1 Corinthians" / "1Cor".
// A trailing "-20" or "&20" after the first verse number tags a range,
// e.g. "@1 Cor 6:19-20" or "@1 Cor 6:19&20".
const TAG_PATTERN = /@([1-3]?\s?[A-Za-z]+)\.?\s+(\d+):(\d+)(?:\s*[-&]\s*(\d+))?/g

// A stray "-2026" after a verse number (a typo, a year, a phone extension)
// shouldn't silently expand into dozens of tagged verses — cap the range.
const MAX_RANGE = 50

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

export function parseVerseTags(text: string): ParsedTag[] {
  const tags: ParsedTag[] = []
  for (const m of text.matchAll(TAG_PATTERN)) {
    const [full, bookRaw, chapterRaw, verseRaw, verseEndRaw] = m
    const code = resolveBook(bookRaw)
    if (!code || m.index === undefined) continue
    const chapter = Number.parseInt(chapterRaw, 10)
    const verseStart = Number.parseInt(verseRaw, 10)
    const parsedEnd = verseEndRaw ? Number.parseInt(verseEndRaw, 10) : verseStart
    const verseEnd = parsedEnd >= verseStart && parsedEnd - verseStart <= MAX_RANGE ? parsedEnd : verseStart

    const verseIds: string[] = []
    for (let v = verseStart; v <= verseEnd; v++) {
      verseIds.push(`${code}.${chapter}.${v}`)
    }

    tags.push({
      match: full,
      start: m.index,
      end: m.index + full.length,
      book: code,
      chapter,
      verseStart,
      verseEnd,
      verseIds,
    })
  }
  return tags
}
