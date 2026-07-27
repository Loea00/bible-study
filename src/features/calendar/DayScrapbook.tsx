import { Link } from 'react-router-dom'
import type { Entry } from '../../types/db'
import { useCalendarDay } from './useCalendarDay'
import { EntryBody } from '../journal/EntryBody'
import { AnchorScripture } from '../reading/AnchorScripture'
import { formatReferenceRange, parseVerseId } from '../reading/books'

const PRAYER_ENTRY_LABEL: Partial<Record<Entry['entry_type'], string>> = {
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
  vision: 'Vision',
}

// Read-only "diary page" rendering of one entry -- reuses the same
// .journal-card/EntryBody/AnchorScripture markup JournalEntryCard.tsx
// already established, just without the edit/delete actions (editing
// stays on Journal/Prayer, Day view is a display surface only).
function DayEntryCard({ entry }: { entry: Entry }) {
  return (
    <article className="journal-card">
      <div className="journal-card-header">
        <div>
          {entry.entry_type === 'reflection' && <span className="journal-card-badge">Reflection</span>}
          {entry.entry_type === 'margin_note' && <span className="journal-card-badge">Margin note</span>}
          {PRAYER_ENTRY_LABEL[entry.entry_type] && (
            <span className="journal-card-badge">{PRAYER_ENTRY_LABEL[entry.entry_type]}</span>
          )}
          {entry.title && <h2>{entry.title}</h2>}
          {(entry.entry_type === 'reflection' || entry.entry_type === 'margin_note') &&
            entry.anchor_start &&
            entry.anchor_end && (
              <Link
                to={`/?book=${parseVerseId(entry.anchor_start).book}&chapter=${parseVerseId(entry.anchor_start).chapter}`}
                className="journal-card-reference"
              >
                {formatReferenceRange(entry.anchor_start, entry.anchor_end)}
              </Link>
            )}
        </div>
      </div>
      {entry.entry_type === 'reflection' && <AnchorScripture entryId={entry.id} />}
      <EntryBody text={entry.body} />
    </article>
  )
}

interface DayScrapbookProps {
  date: Date
}

export function DayScrapbook({ date }: DayScrapbookProps) {
  const { sessions, entries, answeredPrayers, loading } = useCalendarDay(date)

  const heading = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const isEmpty = !loading && sessions.length === 0 && entries.length === 0 && answeredPrayers.length === 0

  return (
    <div className="calendar-day-scrapbook">
      <h1 className="calendar-day-heading">{heading}</h1>

      {loading && <p className="placeholder">Loading…</p>}

      {isEmpty && <p className="placeholder">No entries on this day yet.</p>}

      {sessions.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Reading</h3>
          {sessions.map((session) => (
            <div key={session.id} className="calendar-session-block">
              {session.passage_start && session.passage_end
                ? formatReferenceRange(session.passage_start, session.passage_end)
                : session.passage_start
                  ? parseVerseId(session.passage_start).book
                  : 'A reading session'}
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Notes &amp; Reflections</h3>
          <div className="journal-timeline">
            {entries.map((entry) => (
              <DayEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {answeredPrayers.length > 0 && (
        <div className="calendar-scrapbook-section">
          <h3>Prayer</h3>
          {answeredPrayers.map((request) => (
            <Link key={request.id} to="/prayer" className="calendar-answered-badge">
              Answered: {request.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
