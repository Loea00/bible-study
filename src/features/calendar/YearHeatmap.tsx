import { useCalendarYear } from './useCalendarYear'
import { addDays, endOfYear, isSameDay, localDateKey, startOfDay, startOfWeek, startOfYear } from './dateUtils'

interface YearHeatmapProps {
  year: number
  onSelectDay: (date: Date) => void
  onNavigateYear: (year: number) => void
}

function intensityClass(count: number | undefined): string {
  if (!count) return 'calendar-heatmap-cell--0'
  if (count === 1) return 'calendar-heatmap-cell--1'
  if (count === 2) return 'calendar-heatmap-cell--2'
  return 'calendar-heatmap-cell--3'
}

export function YearHeatmap({ year, onSelectDay, onNavigateYear }: YearHeatmapProps) {
  const { dayMap, stats, loading } = useCalendarYear(year)
  const today = startOfDay(new Date())

  // Columns = weeks, rows = weekdays -- the grid starts on the Sunday
  // on/before Jan 1 so the first partial week still lines up correctly.
  const gridStart = startOfWeek(startOfYear(year))
  const yearEnd = endOfYear(year)
  const weeks: Date[][] = []
  for (let weekStart = gridStart; weekStart <= yearEnd; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)))
  }

  return (
    <div className="calendar-year">
      <div className="calendar-nav">
        <button type="button" onClick={() => onNavigateYear(year - 1)} aria-label="Previous year">
          ‹
        </button>
        <h2>{year}</h2>
        <button type="button" onClick={() => onNavigateYear(year + 1)} aria-label="Next year">
          ›
        </button>
      </div>

      <div className="calendar-year-heatmap">
        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-heatmap-week">
            {week.map((day) => {
              const key = localDateKey(day)
              const inYear = day.getFullYear() === year
              const isFuture = day > today
              const count = dayMap.get(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-heatmap-cell ${inYear ? intensityClass(count) : 'calendar-heatmap-cell--outside'} ${isSameDay(day, today) ? 'calendar-heatmap-cell--today' : ''}`}
                  disabled={!inYear || isFuture}
                  title={inYear ? day.toDateString() : undefined}
                  onClick={() => onSelectDay(day)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {!loading && (
        <div className="calendar-year-stats">
          <div>
            <span className="calendar-year-stat-label">Chapters covered</span>
            <span className="calendar-year-stat-value">{stats.chaptersCovered}</span>
          </div>
          <div>
            <span className="calendar-year-stat-label">Most revisited</span>
            <span className="calendar-year-stat-value">{stats.mostRevisitedPassage ?? '—'}</span>
          </div>
          <div>
            <span className="calendar-year-stat-label">Prayers answered</span>
            <span className="calendar-year-stat-value">{stats.prayersAnswered}</span>
          </div>
          <div>
            <span className="calendar-year-stat-label">First activity</span>
            <span className="calendar-year-stat-value">
              {stats.firstActivity ? stats.firstActivity.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            </span>
          </div>
          <div>
            <span className="calendar-year-stat-label">Last activity</span>
            <span className="calendar-year-stat-value">
              {stats.lastActivity ? stats.lastActivity.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
