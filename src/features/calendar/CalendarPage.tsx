import { useSearchParams } from 'react-router-dom'
import { MonthGrid } from './MonthGrid'
import { WeekStrip } from './WeekStrip'
import { DayScrapbook } from './DayScrapbook'
import { YearHeatmap } from './YearHeatmap'
import { OnThisDayBanner } from './OnThisDayBanner'
import { formatDateParam, isSameDay, parseDateParam } from './dateUtils'

type CalendarViewMode = 'day' | 'week' | 'month' | 'year'

const VIEW_MODES: CalendarViewMode[] = ['day', 'week', 'month', 'year']

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const view = (searchParams.get('view') as CalendarViewMode | null) ?? 'month'
  const date = parseDateParam(searchParams.get('date'))

  function navigate(newView: CalendarViewMode, newDate: Date) {
    setSearchParams({ view: newView, date: formatDateParam(newDate) })
  }

  function handleSelectDay(selected: Date) {
    navigate('day', selected)
  }

  function handleNavigateMonth(year: number, month: number) {
    navigate('month', new Date(year, month, 1))
  }

  return (
    <div className="calendar-page">
      <div className="calendar-view-switcher">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-current={mode === view}
            onClick={() => navigate(mode, date)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {isSameDay(date, new Date()) && <OnThisDayBanner date={date} />}

      {view === 'month' && (
        <MonthGrid
          year={date.getFullYear()}
          month={date.getMonth()}
          onSelectDay={handleSelectDay}
          onNavigateMonth={handleNavigateMonth}
        />
      )}
      {view === 'day' && <DayScrapbook date={date} />}
      {view === 'week' && (
        <WeekStrip date={date} onSelectDay={handleSelectDay} onNavigateWeek={(newDate) => navigate('week', newDate)} />
      )}
      {view === 'year' && (
        <YearHeatmap
          year={date.getFullYear()}
          onSelectDay={handleSelectDay}
          onNavigateYear={(newYear) => navigate('year', new Date(newYear, date.getMonth(), date.getDate()))}
        />
      )}
    </div>
  )
}
