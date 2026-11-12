import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
} from 'lucide-react'
import type { InfoEvent } from '../../lib/info/types'
import {
  dayKeyToDate,
  formatDate,
  pluralPL,
  warsawDayKey,
  WARSAW_TZ,
} from '../../lib/info/time'
import { EventHubCard } from './InfoHubCards'
import '../../styles/info-calendar.css'

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
const MONTH_PATTERN = /^20\d\d-(0[1-9]|1[0-2])$/

function shiftDate(day: string, days: number) {
  const value = dayKeyToDate(day)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function shiftMonth(day: string, months: number) {
  const value = dayKeyToDate(day)
  const date = value.getUTCDate()
  value.setUTCDate(1)
  value.setUTCMonth(value.getUTCMonth() + months)
  const lastDay = new Date(value)
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1)
  lastDay.setUTCDate(0)
  value.setUTCDate(Math.min(date, lastDay.getUTCDate()))
  return value.toISOString().slice(0, 10)
}

/** One source-backed calendar for Start and the public events catalogue. */
export default function InfoEventCalendar({
  events,
  now,
  variant = 'full',
}: {
  events: InfoEvent[]
  now: Date
  variant?: 'full' | 'compact'
}) {
  const [params, setParams] = useSearchParams()
  const id = useId()
  const dateButtons = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)
  const today = warsawDayKey(now)
  const requested = params.get('miesiac') ?? ''
  const month = MONTH_PATTERN.test(requested) ? requested : today.slice(0, 7)
  const first = dayKeyToDate(`${month}-01`)
  const offset = (first.getUTCDay() + 6) % 7
  const dates = Array.from({ length: 42 }, (_, i) =>
    shiftDate(`${month}-01`, i - offset),
  )
  const grouped = new Map<string, InfoEvent[]>()
  for (const event of events)
    grouped.set(event.dayKey, [...(grouped.get(event.dayKey) ?? []), event])
  const eventDays = [...grouped.keys()].sort()
  const requestedDay = params.get('dzien')
  const selected = dates.includes(requestedDay ?? '')
    ? requestedDay!
    : (eventDays.find((day) => day.startsWith(month)) ??
      (today.startsWith(month) ? today : `${month}-01`))
  const selectedEvents = grouped.get(selected) ?? []
  const monthCount = events.filter((event) =>
    event.dayKey.startsWith(month),
  ).length
  const nearestDay = eventDays.find((day) => day >= today)
  const nextDay = eventDays.find((day) => day > selected)
  const visibleEvents =
    variant === 'compact' ? selectedEvents.slice(0, 2) : selectedEvents
  const fullCalendarHref = `/wydarzenia?widok=kalendarz&miesiac=${month}&dzien=${selected}`

  useEffect(() => {
    if (!pendingFocus.current) return
    dateButtons.current.get(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [month, selected])

  const chooseDay = (date: string, moveFocus = false) => {
    if (!MONTH_PATTERN.test(date.slice(0, 7))) return
    if (moveFocus) {
      if (date === selected) dateButtons.current.get(date)?.focus()
      else pendingFocus.current = date
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('miesiac', date.slice(0, 7))
        next.set('dzien', date)
        return next
      },
      { replace: true },
    )
  }
  const moveMonth = (by: number) => {
    const nextMonth = shiftMonth(`${month}-01`, by).slice(0, 7)
    if (!MONTH_PATTERN.test(nextMonth)) return
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('miesiac', nextMonth)
      next.delete('dzien')
      return next
    })
  }
  const handleDayKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    date: string,
  ) => {
    const weekday = (dayKeyToDate(date).getUTCDay() + 6) % 7
    const target =
      event.key === 'ArrowLeft'
        ? shiftDate(date, -1)
        : event.key === 'ArrowRight'
          ? shiftDate(date, 1)
          : event.key === 'ArrowUp'
            ? shiftDate(date, -7)
            : event.key === 'ArrowDown'
              ? shiftDate(date, 7)
              : event.key === 'Home'
                ? shiftDate(date, -weekday)
                : event.key === 'End'
                  ? shiftDate(date, 6 - weekday)
                  : event.key === 'PageUp'
                    ? shiftMonth(date, -1)
                    : event.key === 'PageDown'
                      ? shiftMonth(date, 1)
                      : null
    if (!target) return
    event.preventDefault()
    chooseDay(target, true)
  }

  return (
    <div className={`info-calendar info-calendar-${variant}`}>
      <section className="info-calendar-month" aria-labelledby={`${id}-month`}>
        <header className="info-calendar-toolbar">
          <div>
            <h3 id={`${id}-month`} aria-live="polite">
              {monthLabel.format(first)}
            </h3>
            <p>
              {monthCount}{' '}
              {pluralPL(monthCount, 'wydarzenie', 'wydarzenia', 'wydarzeń')} w
              tym miesiącu
            </p>
          </div>
          <div className="info-calendar-month-nav" aria-label="Zmień miesiąc">
            <button
              type="button"
              aria-label="Poprzedni miesiąc"
              disabled={month === '2000-01'}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Następny miesiąc"
              disabled={month === '2099-12'}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </header>
        <div className="info-calendar-quick-actions">
          <button type="button" onClick={() => chooseDay(today)}>
            <CalendarDays size={15} aria-hidden />
            Dziś
          </button>
          {nearestDay ? (
            <button type="button" onClick={() => chooseDay(nearestDay)}>
              <CornerDownRight size={15} aria-hidden />
              Najbliższe wydarzenie
            </button>
          ) : null}
        </div>
        <div className="info-calendar-weekdays" aria-hidden>
          {['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'].map(
            (day) => (
              <span key={day}>{day}</span>
            ),
          )}
        </div>
        <div
          className="info-calendar-days"
          role="group"
          aria-labelledby={`${id}-month`}
          aria-describedby={`${id}-keyboard`}
        >
          {dates.map((date) => {
            const count = grouped.get(date)?.length ?? 0
            return (
              <button
                key={date}
                ref={(node) => {
                  if (node) dateButtons.current.set(date, node)
                  else dateButtons.current.delete(date)
                }}
                type="button"
                tabIndex={selected === date ? 0 : -1}
                aria-pressed={selected === date}
                aria-current={date === today ? 'date' : undefined}
                className={`${!date.startsWith(month) ? 'info-calendar-outside' : ''} ${count ? 'info-calendar-has-events' : ''}`.trim()}
                aria-label={`${dayLabel.format(dayKeyToDate(date))}, ${count ? `wydarzenia: ${count}` : 'brak nadchodzących wydarzeń'}`}
                onClick={() => chooseDay(date)}
                onKeyDown={(event) => handleDayKey(event, date)}
              >
                <span className="info-calendar-day-number">
                  {Number(date.slice(-2))}
                </span>
                {count ? (
                  <span className="info-calendar-day-count" aria-hidden>
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <p className="sr-only" id={`${id}-keyboard`}>
          Strzałki wybierają dzień. Home i End przechodzą na początek lub koniec
          tygodnia, Page Up i Page Down zmieniają miesiąc.
        </p>
        <div className="info-calendar-legend">
          <span>
            <i aria-hidden />
            Dzień z wydarzeniem
          </span>
          <span>Nadchodzące · czas w Polsce</span>
        </div>
      </section>

      <section
        className="info-calendar-agenda"
        aria-labelledby={`${id}-agenda`}
      >
        <header
          className="info-calendar-agenda-heading"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="info-calendar-date-icon" aria-hidden>
            <CalendarDays size={20} strokeWidth={1.75} />
          </span>
          <div>
            <h3 id={`${id}-agenda`}>
              {dayLabel.format(dayKeyToDate(selected))}
            </h3>
            <p>
              {selectedEvents.length
                ? `${selectedEvents.length} ${pluralPL(selectedEvents.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}`
                : 'Brak nadchodzących wydarzeń'}
            </p>
          </div>
        </header>
        {visibleEvents.length ? (
          <ul className="info-calendar-agenda-list">
            {visibleEvents.map((item) => (
              <li key={item.id}>
                <EventHubCard item={item} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="info-calendar-empty">
            <CalendarDays size={28} strokeWidth={1.5} aria-hidden />
            <p>Wybierz inny dzień lub przejdź do najbliższego wydarzenia.</p>
            {nextDay || nearestDay ? (
              <button
                type="button"
                onClick={() => chooseDay((nextDay ?? nearestDay)!)}
              >
                Pokaż {formatDate(dayKeyToDate((nextDay ?? nearestDay)!), now)}{' '}
                <ArrowRight size={15} aria-hidden />
              </button>
            ) : (
              <span>Nie ma kolejnych wydarzeń w pobranym kalendarzu.</span>
            )}
          </div>
        )}
        {selectedEvents.length > visibleEvents.length ? (
          <p className="info-calendar-more">
            Jeszcze {selectedEvents.length - visibleEvents.length} w tym dniu —
            zobacz pełny kalendarz.
          </p>
        ) : null}
        <footer className="info-calendar-agenda-footer">
          <p>Godziny i zapisy sprawdź w źródle wydarzenia.</p>
          {variant === 'compact' ? (
            <Link to={fullCalendarHref}>
              Pełny kalendarz <ArrowRight size={15} aria-hidden />
            </Link>
          ) : nextDay ? (
            <button type="button" onClick={() => chooseDay(nextDay)}>
              Następny termin <ArrowRight size={15} aria-hidden />
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
