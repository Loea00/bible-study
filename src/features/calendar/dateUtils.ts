import { localDateKey } from '../log/useReadingLog'

export { localDateKey }

// URL date param is the same YYYY-MM-DD shape as localDateKey -- kept as a
// distinct name at the URL-serialization boundary for readability, not a
// different format.
export const formatDateParam = localDateKey

export function parseDateParam(value: string | null): Date {
  if (value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (match) {
      const [, y, m, d] = match
      const parsed = new Date(Number(y), Number(m) - 1, Number(d))
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return new Date()
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  const copy = startOfDay(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

// Sunday-start weeks -- no existing weekly-UI convention in the app to
// anchor to; matches native Date.getDay() indexing (0 = Sunday), avoiding
// extra offset math.
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay())
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6)
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0)
}

export function startOfYear(year: number): Date {
  return new Date(year, 0, 1)
}

export function endOfYear(year: number): Date {
  return new Date(year, 11, 31)
}

// Full 7-column grid including leading/trailing days from adjacent months,
// always a multiple of 7 (5 or 6 rows) so MonthGrid can lay out a clean
// rectangle.
export function monthGridDates(year: number, month: number): Date[] {
  const first = startOfMonth(year, month)
  const last = endOfMonth(year, month)
  const gridStart = addDays(first, -first.getDay())
  const gridEnd = addDays(last, 6 - last.getDay())
  const dates: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    dates.push(d)
  }
  return dates
}

export function eachDayOfYear(year: number): Date[] {
  const dates: Date[] = []
  for (let d = startOfYear(year); d <= endOfYear(year); d = addDays(d, 1)) {
    dates.push(d)
  }
  return dates
}

export function isSameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isSameDay(a: Date, b: Date): boolean {
  return localDateKey(a) === localDateKey(b)
}
