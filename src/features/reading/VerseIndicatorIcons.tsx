// Spec §5.1: "small icons beside verses that carry user content (note icon
// = margin notes/reflections, notebook icon = journal references)" — a
// deliberate Phase 1 simplification (plain dots) replaced with the actual
// icons now that the dot-vs-icon distinction started causing confusion
// between the two kinds of marks. Highlights keep their color dots — those
// are meant to read as color, not shape, per spec amendment v1.1 §A6.
//
// Notes and reflections split into two different icons (pencil vs heart)
// rather than sharing one, since Aaron draws a real distinction between
// them: margin notes are scholastic/analytical, reflections are
// experiential/personal — the spec's own "note icon = margin
// notes/reflections" grouping undersold that difference.

export function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function ReflectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  )
}

export function JournalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}
