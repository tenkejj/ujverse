import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { InfoEvent } from '../../lib/info/types'
import { dayKeyToDate, warsawDayKey, WARSAW_TZ } from '../../lib/info/time'
import { EventHubCard } from './InfoHubCards'

const monthLabel = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
  timeZone: WARSAW_TZ,
})
const dayLabel = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  timeZone: WARSAW_TZ,
})

/** Calendar and list share the same public event data; dates use Warsaw days. */
export default function InfoEventCalendar({
  events,
  now,
}: {
  events: InfoEvent[]
  now: Date
}) {
  const [params, setParams] = useSearchParams()
  const today = warsawDayKey(now)
  const requested = params.get('miesiac') ?? ''
  const month = /^20\d\d-(0[1-9]|1[0-2])$/.test(requested)
    ? requested
    : today.slice(0, 7)
  const first = dayKeyToDate(`${month}-01`)
  const offset = (first.getUTCDay() + 6) % 7
  const dates = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first)
    d.setUTCDate(d.getUTCDate() + i - offset)
    return d.toISOString().slice(0, 10)
  })
  const grouped = new Map<string, InfoEvent[]>()
  for (const event of events)
    grouped.set(event.dayKey, [...(grouped.get(event.dayKey) ?? []), event])
  const requestedDay = params.get('dzien')
  const selected = dates.includes(requestedDay ?? '')
    ? requestedDay!
    : (events.find((item) => item.dayKey.startsWith(month))?.dayKey ??
      `${month}-01`)
  const selectedEvents = grouped.get(selected) ?? []
  const shift = (by: number) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      const d = new Date(first)
      d.setUTCMonth(d.getUTCMonth() + by)
      next.set('miesiac', d.toISOString().slice(0, 7))
      next.delete('dzien')
      return next
    })
  return (
    <div className="campus-event-calendar">
      <div>
        <div className="campus-calendar-toolbar">
          <h2>{monthLabel.format(first)}</h2>
          <div>
            <button
              type="button"
              aria-label="Poprzedni miesiąc"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={19} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.delete('miesiac')
                  next.set('dzien', today)
                  return next
                })
              }
            >
              Dziś
            </button>
            <button
              type="button"
              aria-label="Następny miesiąc"
              onClick={() => shift(1)}
            >
              <ChevronRight size={19} aria-hidden />
            </button>
          </div>
        </div>
        <div className="campus-calendar-weekdays" aria-hidden>
          {['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'].map(
            (day) => (
              <span key={day}>{day}</span>
            ),
          )}
        </div>
        <div
          className="campus-calendar-days"
          role="group"
          aria-label={monthLabel.format(first)}
        >
          {dates.map((date) => {
            const count = grouped.get(date)?.length ?? 0
            return (
              <button
                key={date}
                type="button"
                aria-pressed={selected === date}
                aria-current={date === today ? 'date' : undefined}
                className={
                  !date.startsWith(month) ? 'campus-calendar-outside' : ''
                }
                aria-label={`${dayLabel.format(dayKeyToDate(date))}, ${count ? `wydarzenia: ${count}` : 'brak wydarzeń'}`}
                onClick={() =>
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous)
                      next.set('dzien', date)
                      return next
                    },
                    { replace: true },
                  )
                }
              >
                <span>{Number(date.slice(-2))}</span>
                {count ? (
                  <span className="campus-calendar-event-count" aria-hidden>
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <p className="campus-calendar-hint">
          Liczba przy dniu oznacza nadchodzące wydarzenia. Wybierz datę, żeby
          zobaczyć szczegóły.
        </p>
      </div>
      <section
        className="campus-calendar-day"
        aria-labelledby="calendar-day-heading"
        aria-live="polite"
      >
        <h2 id="calendar-day-heading">
          {dayLabel.format(dayKeyToDate(selected))}
        </h2>
        {selectedEvents.length ? (
          <ul className="campus-event-list">
            {selectedEvents.map((item) => (
              <li key={item.id}>
                <EventHubCard item={item} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <p>Brak nadchodzących wydarzeń na ten dzień.</p>
        )}
      </section>
    </div>
  )
}
