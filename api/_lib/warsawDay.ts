/** Civil-day boundaries for the university's timezone, independent of the host clock. */
const WARSAW_TIME_ZONE = 'Europe/Warsaw'
const wallClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: WARSAW_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function wallParts(date: Date) {
  const parts = wallClock.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)!.value)
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  }
}

export function warsawCivilDate(now: Date = new Date()): string {
  const { year, month, day } = wallParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Warsaw changes DST after midnight, so each local midnight is unambiguous. */
function midnightUtc(year: number, month: number, day: number): number {
  const targetWallTime = Date.UTC(year, month - 1, day)
  let candidate = targetWallTime
  for (let attempt = 0; attempt < 3; attempt++) {
    const wall = wallParts(new Date(candidate))
    const observedWallTime = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    )
    const adjustment = targetWallTime - observedWallTime
    candidate += adjustment
    if (adjustment === 0) break
  }
  return candidate
}

/** Inclusive range: count civil days, then subtract 1 ms from the next midnight. */
export function warsawDayRangeISO(
  now: Date = new Date(),
  dayOffset = 0,
  dayCount = 1,
): { start: string; end: string } {
  const { year, month, day } = wallParts(now)
  // UTC here performs calendar arithmetic only; conversion to Warsaw follows it.
  const firstDay = new Date(Date.UTC(year, month - 1, day + dayOffset))
  const afterLastDay = new Date(
    Date.UTC(year, month - 1, day + dayOffset + dayCount),
  )
  const start = midnightUtc(
    firstDay.getUTCFullYear(),
    firstDay.getUTCMonth() + 1,
    firstDay.getUTCDate(),
  )
  const end =
    midnightUtc(
      afterLastDay.getUTCFullYear(),
      afterLastDay.getUTCMonth() + 1,
      afterLastDay.getUTCDate(),
    ) - 1
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  }
}
