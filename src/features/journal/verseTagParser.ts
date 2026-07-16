import { BOOKS } from '../reading/books'

export interface ParsedTag {
  match: string
  start: number
  end: number
  verseId: string
  book: string
  chapter: number
  verse: number
}

// @<book> <chapter>:<verse> — book may be a full name ("Psalms"), a USFM
// code ("PSA"), or any prefix of the full name ("Ps", "Gen"). Leading
// "1"/"2"/"3" handles books like "1 Corinthians" / "1Cor".
const TAG_PATTERN = /@([1-3]?\s?[A-Za-z]+)\.?\s+(\d+):(\d+)/g

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
    const [full, bookRaw, chapterRaw, verseRaw] = m
    const code = resolveBook(bookRaw)
    if (!code || m.index === undefined) continue
    const chapter = Number.parseInt(chapterRaw, 10)
    const verse = Number.parseInt(verseRaw, 10)
    tags.push({
      match: full,
      start: m.index,
      end: m.index + full.length,
      verseId: `${code}.${chapter}.${verse}`,
      book: code,
      chapter,
      verse,
    })
  }
  return tags
}
