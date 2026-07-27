import { Link } from 'react-router-dom'
import { useOnThisDay } from './useOnThisDay'
import { composeOnThisDaySentence } from './summaryText'
import { formatDateParam } from './dateUtils'

interface OnThisDayBannerProps {
  date: Date
}

export function OnThisDayBanner({ date }: OnThisDayBannerProps) {
  const { years, loading } = useOnThisDay(date)

  if (loading || years.length === 0) return null

  return (
    <div className="calendar-on-this-day">
      <h3>On this day</h3>
      {years.map((year) => {
        const sentence = composeOnThisDaySentence(year.yearsAgo, year.sessions, year.entries, year.answeredPrayers)
        if (!sentence) return null
        const historicalDate = new Date(year.year, date.getMonth(), date.getDate())
        return (
          <Link
            key={year.year}
            to={`/calendar?view=day&date=${formatDateParam(historicalDate)}`}
            className="calendar-on-this-day-year"
          >
            {sentence}
          </Link>
        )
      })}
    </div>
  )
}
