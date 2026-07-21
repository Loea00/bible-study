import { useState } from 'react'
import type { BookIntroduction } from '../../types/db'

const COMMENTARY_SOURCE_LABEL: Record<string, string> = {
  JFB: "Jamieson-Fausset-Brown Commentary",
}

// Shown once above chapter 1, not per-verse -- these are book-level
// introduction essays some commentary sources write (authorship, date,
// themes), previously glued onto verse 1's own commentary entry. Same
// collapsed-by-default/expandable treatment as CommentaryItem in
// VersePanel.tsx, since these can run very long (Genesis's JFB intro is
// ~80KB, a full essay on Pentateuch authorship).
interface BookIntroItemProps {
  intro: BookIntroduction
}

function BookIntroItem({ intro }: BookIntroItemProps) {
  const [expanded, setExpanded] = useState(false)
  const paragraphs = intro.body.split('\n\n')
  const hasMore = paragraphs.length > 1

  return (
    <div className="book-intro-item">
      <span className="book-intro-title">About this book -- {COMMENTARY_SOURCE_LABEL[intro.source] ?? intro.source}</span>
      <p className="book-intro-text">{paragraphs[0]}</p>
      {expanded &&
        paragraphs.slice(1).map((p, i) => (
          <p key={i} className="book-intro-text">
            {p}
          </p>
        ))}
      {hasMore && (
        <button type="button" className="anchor-scripture-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less ▲' : 'Show more ▾'}
        </button>
      )}
    </div>
  )
}

interface BookIntroductionsProps {
  introductions: BookIntroduction[]
}

export function BookIntroductions({ introductions }: BookIntroductionsProps) {
  if (introductions.length === 0) return null

  return (
    <div className="book-intros">
      {introductions.map((intro) => (
        <BookIntroItem key={intro.id} intro={intro} />
      ))}
    </div>
  )
}
