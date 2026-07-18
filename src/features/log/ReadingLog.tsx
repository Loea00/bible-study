import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReadingLog } from './useReadingLog'
import { BOOK_BY_CODE } from '../reading/books'

function formatPassage(id: string): string {
  const [book, chapter] = id.split('.')
  const name = BOOK_BY_CODE[book]?.name ?? book
  return `${name} ${chapter}`
}

function formatTimeSpan(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : start
  const dateStr = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
  return `${dateStr} · ${startTime} · ${durationMin} min`
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  margin_note: 'Note',
  journal: 'Journal',
  reflection: 'Reflection',
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
}

export function ReadingLog() {
  const {
    sessions,
    loading,
    notesThisMonth,
    streak,
    entriesBySession,
    loadSessionEntries,
    prayedCountBySession,
    loadSessionPrayedMarks,
  } = useReadingLog()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const now = new Date()
  const sessionsThisMonth = sessions.filter((s) => {
    const d = new Date(s.started_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  function toggleExpand(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(sessionId)
    loadSessionEntries(sessionId)
    loadSessionPrayedMarks(sessionId)
  }

  return (
    <div className="reading-log">
      <div className="log-stats">
        <div className="log-stat">
          <span className="log-stat-value">{streak}</span>
          <span className="log-stat-label">day streak</span>
        </div>
        <div className="log-stat">
          <span className="log-stat-value">{sessionsThisMonth}</span>
          <span className="log-stat-label">sessions this month</span>
        </div>
        <div className="log-stat">
          <span className="log-stat-value">{notesThisMonth}</span>
          <span className="log-stat-label">notes this month</span>
        </div>
      </div>

      {loading && <p className="placeholder">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <p className="placeholder">No reading sessions yet — open a passage to start one.</p>
      )}

      <div className="log-sessions">
        {sessions.map((session) => (
          <div key={session.id} className="log-session">
            <button
              type="button"
              className="log-session-row"
              onClick={() => toggleExpand(session.id)}
            >
              <span className="log-session-passage">
                {session.passage_start ? formatPassage(session.passage_start) : 'Unknown passage'}
                {session.passage_end && session.passage_end !== session.passage_start
                  ? ` – ${formatPassage(session.passage_end)}`
                  : ''}
              </span>
              <span className="log-session-meta">
                {formatTimeSpan(session.started_at, session.ended_at)}
              </span>
            </button>

            {expandedId === session.id && (
              <div className="log-session-entries">
                {(prayedCountBySession[session.id] ?? 0) > 0 && (
                  <p className="log-session-prayed">
                    Prayed for {prayedCountBySession[session.id]} request
                    {prayedCountBySession[session.id] === 1 ? '' : 's'}
                  </p>
                )}
                {entriesBySession[session.id] === undefined && (
                  <p className="placeholder">Loading…</p>
                )}
                {entriesBySession[session.id]?.length === 0 && (prayedCountBySession[session.id] ?? 0) === 0 && (
                  <p className="placeholder">Nothing written during this session.</p>
                )}
                {entriesBySession[session.id]?.map((entry) => {
                  const isNote = entry.entry_type === 'margin_note'
                  const anchorParts = isNote && entry.anchor_start ? entry.anchor_start.split('.') : null
                  return (
                    <div key={entry.id} className="log-session-entry">
                      <span className="log-session-entry-type">{ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}</span>
                      {isNote ? (
                        <Link
                          to={anchorParts ? `/?book=${anchorParts[0]}&chapter=${anchorParts[1]}` : '/'}
                          className="log-session-entry-link"
                        >
                          {entry.body.length > 60 ? `${entry.body.slice(0, 60)}…` : entry.body} →
                        </Link>
                      ) : (
                        <Link to={`/journal?entry=${entry.id}`} className="log-session-entry-link">
                          {entry.title ?? 'Untitled entry'} →
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
