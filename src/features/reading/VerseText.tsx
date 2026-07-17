import { Fragment, type ReactNode } from 'react'
import type { WordTag } from './useWordTags'

interface VerseTextProps {
  text: string
  tags: WordTag[]
  onWordTap: (strongsIds: string[]) => void
}

// word_tags gives an ordered sequence of tagged phrases, not character
// offsets — punctuation between/around tagged words lives untagged in the
// source, so offsets wouldn't reconstruct cleanly anyway. Instead, walk the
// verse text with a cursor and find each phrase in sequence; anything
// between matches (spaces, punctuation, the rare untagged word) renders as
// plain text. A tag whose text can't be found from the current cursor
// (source-text drift between the two datasets) is skipped rather than
// breaking the render.
export function VerseText({ text, tags, onWordTap }: VerseTextProps) {
  if (tags.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let cursor = 0

  tags.forEach((tag, i) => {
    const start = text.indexOf(tag.text, cursor)
    if (start === -1) return

    if (start > cursor) {
      parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, start)}</Fragment>)
    }

    const strongsIds = tag.strongs_ids.split(',')
    parts.push(
      <span
        key={`w${i}`}
        className="tappable-word"
        onClick={(e) => {
          e.stopPropagation()
          onWordTap(strongsIds)
        }}
      >
        {tag.text}
      </span>,
    )
    cursor = start + tag.text.length
  })

  if (cursor < text.length) {
    parts.push(<Fragment key="last">{text.slice(cursor)}</Fragment>)
  }

  return <>{parts}</>
}
