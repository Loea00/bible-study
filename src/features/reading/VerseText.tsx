import { Fragment, type ReactNode } from 'react'
import type { WordTag } from './useWordTags'
import type { HighlightColor } from '../../types/db'
import type { SelectionSpan } from './selection'

export interface RenderedHighlight {
  startOffset: number
  endOffset: number
  color: HighlightColor
}

interface VerseTextProps {
  verseId: string
  text: string
  tags: WordTag[]
  highlights: RenderedHighlight[]
  pending: SelectionSpan[]
  onWordTap: (strongsIds: string[]) => void
  onHighlightTap: (color: HighlightColor) => void
}

interface WordInterval {
  start: number
  end: number
  strongsIds: string[]
}

// word_tags gives an ordered sequence of tagged phrases, not character
// offsets — punctuation between/around tagged words lives untagged in the
// source, so offsets wouldn't reconstruct cleanly anyway. Walk the verse
// text with a cursor and find each phrase in sequence; a tag whose text
// can't be found from the current cursor (source-text drift between the
// two datasets) is skipped rather than breaking the render.
function findWordIntervals(text: string, tags: WordTag[]): WordInterval[] {
  const intervals: WordInterval[] = []
  let cursor = 0
  for (const tag of tags) {
    const start = text.indexOf(tag.text, cursor)
    if (start === -1) continue
    const end = start + tag.text.length
    intervals.push({ start, end, strongsIds: tag.strongs_ids.split(',') })
    cursor = end
  }
  return intervals
}

// Word-tap spans and highlight spans can overlap arbitrarily (a highlighted
// phrase still has word-tap targets inside it). Cut the text at every
// interval boundary from both sets, then render each resulting segment
// wrapped in whichever of the two applies to it — this handles overlap
// without needing to merge/split the source intervals themselves.
export function VerseText({ verseId, text, tags, highlights, pending, onWordTap, onHighlightTap }: VerseTextProps) {
  const wordIntervals = findWordIntervals(text, tags)

  if (wordIntervals.length === 0 && highlights.length === 0 && pending.length === 0) {
    return (
      <span data-verse-content={verseId}>{text}</span>
    )
  }

  const cutPoints = new Set<number>([0, text.length])
  for (const w of wordIntervals) {
    cutPoints.add(w.start)
    cutPoints.add(w.end)
  }
  for (const h of highlights) {
    cutPoints.add(h.startOffset)
    cutPoints.add(h.endOffset)
  }
  for (const p of pending) {
    cutPoints.add(p.startOffset)
    cutPoints.add(p.endOffset)
  }
  const sorted = [...cutPoints].sort((a, b) => a - b)

  const parts: ReactNode[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    if (start >= end) continue

    const word = wordIntervals.find((w) => w.start <= start && w.end >= end)
    const highlight = highlights.find((h) => h.startOffset <= start && h.endOffset >= end)
    const isPending = pending.some((p) => p.startOffset <= start && p.endOffset >= end)

    let node: ReactNode = text.slice(start, end)

    if (word) {
      node = (
        <span
          className="tappable-word"
          onClick={(e) => {
            e.stopPropagation()
            onWordTap(word.strongsIds)
          }}
        >
          {node}
        </span>
      )
    }

    if (highlight) {
      node = (
        <span
          className={`highlight-mark highlight-${highlight.color}`}
          onClick={(e) => {
            e.stopPropagation()
            onHighlightTap(highlight.color)
          }}
        >
          {node}
        </span>
      )
    }

    if (isPending) {
      node = <span className="pending-mark">{node}</span>
    }

    parts.push(<Fragment key={`${start}-${end}`}>{node}</Fragment>)
  }

  return <span data-verse-content={verseId}>{parts}</span>
}
