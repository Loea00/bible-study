import { useCalendarMonth } from './useCalendarMonth'
import { addDays, isSameDay, localDateKey, monthGridDates, startOfDay } from './dateUtils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthGridProps {
  year: number
  month: number
  onSelectDay: (date: Date) => void
  onNavigateMonth: (year: number, month: number) => void
}

export function MonthGrid({ year, month, onSelectDay, onNavigateMonth }: MonthGridProps) {
  const { dayMap, loading } = useCalendarMonth(year, month)
  const dates = monthGridDates(year, month)
  const today = startOfDay(new Date())

  function goPrev() {
    const prev = addDays(new Date(year, month, 1), -1)
    onNavigateMonth(prev.getFullYear(), prev.getMonth())
  }
  function goNext() {
    const next = new Date(year, month + 1, 1)
    onNavigateMonth(next.getFullYear(), next.getMonth())
  }

  return (
    <div className="calendar-month">
      <div className="calendar-nav">
        <button type="button" onClick={goPrev} aria-label="Previous month">
          ‹
        </button>
        <h2>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button type="button" onClick={goNext} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="calendar-month-grid calendar-month-grid-header">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday-label">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-month-grid">
        {dates.map((date) => {
          const key = localDateKey(date)
          const flags = dayMap.get(key)
          const isOutside = date.getMonth() !== month
          const isToday = isSameDay(date, today)
          const isFuture = date > today

          const classNames = ['calendar-day-cell']
          if (isOutside) classNames.push('calendar-day-cell--outside')
          if (isToday) classNames.push('calendar-day-cell--today')
          if (isFuture) classNames.push('calendar-day-cell--future')

          return (
            <button
              key={key}
              type="button"
              className={classNames.join(' ')}
              disabled={isFuture}
              onClick={() => onSelectDay(date)}
            >
              <span className="calendar-day-number">{date.getDate()}</span>
              {!loading && flags && (
                <span className="calendar-day-markers">
                  {flags.hasSession && <span className="calendar-dot-session" />}
                  {flags.hasEntry && <span className="calendar-dot-entry" />}
                  {flags.answeredCount > 0 && <span className="calendar-dot-answered" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
