import { useCalendarWeek } from './useCalendarWeek'
import { composeWeekSummary } from './summaryText'
import { addDays, isSameDay, localDateKey, startOfDay, startOfWeek } from './dateUtils'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface WeekStripProps {
  date: Date
  onSelectDay: (date: Date) => void
  onNavigateWeek: (newDate: Date) => void
}

export function WeekStrip({ date, onSelectDay, onNavigateWeek }: WeekStripProps) {
  const weekStart = startOfWeek(date)
  const { sessions, entries, answeredPrayers, loading } = useCalendarWeek(weekStart)
  const today = startOfDay(new Date())

  const sessionsByDay = new Map<string, boolean>()
  const entriesByDay = new Map<string, boolean>()
  const answeredByDay = new Map<string, boolean>()
  for (const s of sessions) sessionsByDay.set(localDateKey(new Date(s.started_at)), true)
  for (const e of entries) entriesByDay.set(localDateKey(new Date(e.created_at)), true)
  for (const p of answeredPrayers) {
    if (p.answered_at) answeredByDay.set(localDateKey(new Date(p.answered_at)), true)
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <div className="calendar-week">
      <div className="calendar-nav">
        <button type="button" onClick={() => onNavigateWeek(addDays(weekStart, -7))} aria-label="Previous week">
          ‹
        </button>
        <h2>{rangeLabel}</h2>
        <button type="button" onClick={() => onNavigateWeek(addDays(weekStart, 7))} aria-label="Next week">
          ›
        </button>
      </div>

      {!loading && (
        <p className="calendar-week-summary">{composeWeekSummary(sessions, entries, answeredPrayers)}</p>
      )}

      <div className="calendar-week-strip">
        {days.map((day) => {
          const key = localDateKey(day)
          const isToday = isSameDay(day, today)
          const isFuture = day > today
          const classNames = ['calendar-day-cell', 'calendar-week-day-cell']
          if (isToday) classNames.push('calendar-day-cell--today')
          if (isFuture) classNames.push('calendar-day-cell--future')

          return (
            <button
              key={key}
              type="button"
              className={classNames.join(' ')}
              disabled={isFuture}
              onClick={() => onSelectDay(day)}
            >
              <span className="calendar-weekday-label">{WEEKDAY_LABELS[day.getDay()]}</span>
              <span className="calendar-day-number">{day.getDate()}</span>
              <span className="calendar-day-markers">
                {sessionsByDay.get(key) && <span className="calendar-dot-session" />}
                {entriesByDay.get(key) && <span className="calendar-dot-entry" />}
                {answeredByDay.get(key) && <span className="calendar-dot-answered" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
