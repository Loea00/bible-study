import type { Entry, PrayerRequest, ReadingSession } from '../../types/db'
import { formatReferenceRange } from '../reading/books'

// Shared "N sessions, M entries, K answered -> warm sentence" composition,
// used by both Week view's summary and On This Day's per-year callouts --
// kept as pure functions (no data fetching) so a future AI-generated
// version is a drop-in body swap, not a call-site change.

function focalPassage(sessions: ReadingSession[], entries: Entry[]): string | null {
  const anchored = entries.find((e) => e.anchor_start && e.anchor_end)
  if (anchored?.anchor_start && anchored?.anchor_end) {
    return formatReferenceRange(anchored.anchor_start, anchored.anchor_end)
  }
  const session = sessions.find((s) => s.passage_start)
  if (session?.passage_start) {
    return formatReferenceRange(session.passage_start, session.passage_end ?? session.passage_start)
  }
  return null
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 0) return ''
  if (clauses.length === 1) return clauses[0]
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`
}

// "you"-clauses (read/wrote -- share an implied "you" subject) are kept
// separate from the prayer clause (its own subject, "a prayer was
// answered") so composing the final sentence never produces "you a
// prayer was answered."
function activityClauses(
  sessions: ReadingSession[],
  entries: Entry[],
  answeredPrayers: PrayerRequest[],
): { youClauses: string[]; prayerClause: string | null } {
  const passage = focalPassage(sessions, entries)
  const youClauses: string[] = []

  if (sessions.length > 0) {
    youClauses.push(passage ? `read ${passage}` : 'read scripture')
  }
  if (entries.length > 0) {
    const label = entries.length === 1 ? 'wrote once' : `wrote ${entries.length} times`
    youClauses.push(passage && sessions.length === 0 ? `wrote about ${passage}` : label)
  }

  const prayerClause =
    answeredPrayers.length === 0
      ? null
      : answeredPrayers.length === 1
        ? 'a prayer was answered'
        : `${answeredPrayers.length} prayers were answered`

  return { youClauses, prayerClause }
}

function composeSentence(lead: string, sessions: ReadingSession[], entries: Entry[], answeredPrayers: PrayerRequest[]): string | null {
  const { youClauses, prayerClause } = activityClauses(sessions, entries, answeredPrayers)
  if (youClauses.length === 0 && !prayerClause) return null

  if (youClauses.length > 0 && prayerClause) {
    return `${lead} you ${joinClauses(youClauses)}, and ${prayerClause}.`
  }
  if (youClauses.length > 0) {
    return `${lead} you ${joinClauses(youClauses)}.`
  }
  return `${lead} ${prayerClause}.`
}

export function composeWeekSummary(
  sessions: ReadingSession[],
  entries: Entry[],
  answeredPrayers: PrayerRequest[],
): string {
  return composeSentence('This week', sessions, entries, answeredPrayers) ?? 'No activity recorded this week.'
}

export function composeOnThisDaySentence(
  yearsAgo: number,
  sessions: ReadingSession[],
  entries: Entry[],
  answeredPrayers: PrayerRequest[],
): string | null {
  const lead = yearsAgo === 1 ? 'One year ago today,' : `${yearsAgo} years ago today,`
  return composeSentence(lead, sessions, entries, answeredPrayers)
}
