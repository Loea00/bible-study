import { Fragment, type ReactNode } from 'react'
import { parseVerseTags } from './verseTagParser'
import { VerseTagChip } from './VerseTagChip'

export function EntryBody({ text }: { text: string }) {
  const tags = parseVerseTags(text)
  if (tags.length === 0) return <p className="entry-body">{text}</p>

  const parts: ReactNode[] = []
  let cursor = 0
  tags.forEach((tag, i) => {
    if (tag.start > cursor) {
      parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, tag.start)}</Fragment>)
    }
    parts.push(
      <VerseTagChip
        key={`c${i}`}
        book={tag.book}
        chapter={tag.chapter}
        verseStart={tag.verseStart}
        verseEnd={tag.verseEnd}
        verseIds={tag.verseIds}
      />,
    )
    cursor = tag.end
  })
  if (cursor < text.length) {
    parts.push(<Fragment key="last">{text.slice(cursor)}</Fragment>)
  }

  return <p className="entry-body">{parts}</p>
}
