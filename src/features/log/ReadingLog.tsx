import { useState } from 'react'
import { Link } from 'react-router-dom'
import { localDateKey, useReadingLog } from './useReadingLog'
import { BOOK_BY_CODE } from '../reading/books'
import type { ReadingSession } from '../../types/db'

function formatPassage(id: string): string {
  const [book, chapter] = id.split('.')
  const name = BOOK_BY_CODE[book]?.name ?? book
  return `${name} ${chapter}`
}

function formatDateHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimeSpan(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : start
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
  return `${startTime} · ${durationMin} min`
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  margin_note: 'Note',
  journal: 'Journal',
  reflection: 'Reflection',
  prayer_update: 'Update',
  word: 'Word',
  concern: 'Concern',
}

function groupByDate(sessions: ReadingSession[]): [string, ReadingSession[]][] {
  const map = new Map<string, ReadingSession[]>()
  for (const session of sessions) {
    const key = localDateKey(new Date(session.started_at))
    const group = map.get(key)
    if (group) {
      group.push(session)
    } else {
      map.set(key, [session])
    }
  }
  return [...map.entries()]
}

export function ReadingLog() {
  const {
    sessions,
    loading,
    notesThisMonth,
    streak,
    entriesBySession,
    prayedCountBySession,
    deleteSession,
    deleteSessionsForDay,
  } = useReadingLog()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const sessionsThisMonth = sessions.filter((s) => {
    const d = new Date(s.started_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  function toggleExpand(sessionId: string) {
    setExpandedId((prev) => (prev === sessionId ? null : sessionId))
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    if (!window.confirm('Delete this session from the log? Notes and journal entries written during it are kept, just unlinked from it.')) {
      return
    }
    setDeletingId(sessionId)
    setError(null)
    try {
      await deleteSession(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the session.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteDay(dateKey: string, daySessions: ReadingSession[]) {
    const count = daySessions.length
    if (
      !window.confirm(
        `Delete all ${count} session${count === 1 ? '' : 's'} on ${formatDateHeader(dateKey)}? Notes and journal entries written during them are kept, just unlinked.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteSessionsForDay(daySessions.map((s) => s.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete these sessions.')
    }
  }

  const grouped = groupByDate(sessions)

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

      {error && <p className="error">{error}</p>}
      {loading && <p className="placeholder">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <p className="placeholder">No reading sessions yet — open a passage to start one.</p>
      )}

      <div className="log-date-groups">
        {grouped.map(([dateKey, daySessions]) => (
          <div key={dateKey} className="log-date-group">
            <div className="log-date-header">
              <h3>{formatDateHeader(dateKey)}</h3>
              <button
                type="button"
                className="log-date-header-delete"
                onClick={() => handleDeleteDay(dateKey, daySessions)}
              >
                Delete day
              </button>
            </div>

            <div className="log-sessions">
              {daySessions.map((session) => {
                const entryCount = entriesBySession[session.id]?.length ?? 0
                const prayedCount = prayedCountBySession[session.id] ?? 0
                const hasArtifacts = entryCount > 0 || prayedCount > 0

                return (
                  <div key={session.id} className="log-session">
                    <button type="button" className="log-session-row" onClick={() => toggleExpand(session.id)}>
                      <span className="log-session-main">
                        <span className="log-session-passage">
                          {session.passage_start ? formatPassage(session.passage_start) : 'Unknown passage'}
                          {session.passage_end && session.passage_end !== session.passage_start
                            ? ` – ${formatPassage(session.passage_end)}`
                            : ''}
                        </span>
                        {hasArtifacts && (
                          <span className="log-session-indicators">
                            {entryCount > 0 && (
                              <span className="log-session-indicator">
                                {entryCount} artifact{entryCount === 1 ? '' : 's'}
                              </span>
                            )}
                            {prayedCount > 0 && (
                              <span className="log-session-indicator">
                                prayed for {prayedCount}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <span className="log-session-controls">
                        <span className="log-session-meta">{formatTimeSpan(session.started_at, session.ended_at)}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="log-session-delete"
                          onClick={(e) => handleDeleteSession(e, session.id)}
                        >
                          {deletingId === session.id ? 'Deleting…' : 'Delete'}
                        </span>
                      </span>
                    </button>

                    {expandedId === session.id && (
                      <div className="log-session-entries">
                        {!hasArtifacts && <p className="placeholder">Nothing written during this session.</p>}
                        {prayedCount > 0 && (
                          <p className="log-session-prayed">
                            Prayed for {prayedCount} request{prayedCount === 1 ? '' : 's'}
                          </p>
                        )}
                        {entriesBySession[session.id]?.map((entry) => {
                          const isNote = entry.entry_type === 'margin_note'
                          const anchorParts = isNote && entry.anchor_start ? entry.anchor_start.split('.') : null
                          return (
                            <div key={entry.id} className="log-session-entry">
                              <span className="log-session-entry-type">
                                {ENTRY_TYPE_LABEL[entry.entry_type] ?? entry.entry_type}
                              </span>
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
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
