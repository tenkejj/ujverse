/**
 * UJverse — CalendarMiniWidget: pasek „najbliższe 7 dni" na dashboardzie.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Małe okienko pokazujące dzisiaj + 6 następnych dni jako poziomy pasek
 * z kolorowymi kropkami pod każdym dniem (kropki = wpisy w kalendarzu).
 * Klik na dzień → nawigacja do /events z taba „Kalendarz" otwartego na tym
 * dniu (`location.state.openCalendarDay`).
 *
 * Filozofia:
 *   - Widget pokazujemy TYLKO desktop (md+). Mobile ma BottomNav „Wydarzenia"
 *     → kalendarz, więc nie zaśmiecamy ekranu drugą ścieżką.
 *   - Pobieramy zakres 7 dni przez `useCalendarEntries` — własny query,
 *     niezależny od głównego CalendarView. Realtime też tu działa, więc
 *     dashboard się aktualizuje gdy scraper coś dorzuci.
 *   - Brak filtrów (zawsze wszystkie kindy) — to view-only ”co przede mną".
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarRange } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  type CalendarEntry,
  type CalendarEntryKind,
} from '../../types/calendar'
import {
  calendarDayKey,
  groupCalendarEntriesByDay,
  useCalendarEntries,
} from '../../hooks/useCalendarEntries'
import { isSameDay, todayLocal } from '../../lib/calendarGrid'

const STRIP_DAYS = 7
const MAX_DOTS = 3

function generateStripDays(): Date[] {
  const start = todayLocal()
  const days: Date[] = []
  for (let i = 0; i < STRIP_DAYS; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function uniqueKinds(entries: readonly CalendarEntry[]): CalendarEntryKind[] {
  const seen = new Set<CalendarEntryKind>()
  for (const e of entries) seen.add(e.kind)
  return Array.from(seen)
}

function formatWeekdayShort(d: Date): string {
  return d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')
}

type Props = {
  className?: string
}

export default function CalendarMiniWidget({ className = '' }: Props) {
  const navigate = useNavigate()
  const days = useMemo(generateStripDays, [])
  const today = useMemo(() => todayLocal(), [])

  const rangeStart = days[0]!
  const rangeEnd = useMemo(() => {
    const last = days[days.length - 1]!
    const end = new Date(last)
    end.setHours(23, 59, 59, 999)
    return end
  }, [days])

  const { entries, loading } = useCalendarEntries({ rangeStart, rangeEnd })
  const entriesByDay = useMemo(() => groupCalendarEntriesByDay(entries), [entries])
  const total = entries.length

  const handleDayClick = (day: Date) => {
    navigate('/events', {
      state: { tab: 'calendar', openCalendarDay: calendarDayKey(day) },
    })
  }

  const handleOpenCalendar = () => {
    navigate('/events', { state: { tab: 'calendar' } })
  }

  return (
    <BaseCard className={`p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange
            size={16}
            strokeWidth={2.25}
            className="text-[#1e293b] dark:text-[#D4AF37] shrink-0"
            aria-hidden
          />
          <h3 className="text-sm font-bold text-fg-primary">Najbliższe 7 dni</h3>
        </div>
        <button
          type="button"
          onClick={handleOpenCalendar}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-fg-secondary transition-colors hover:bg-zinc-100 dark:hover:bg-white/5"
          aria-label="Otwórz pełny kalendarz"
        >
          Otwórz kalendarz
          <ArrowRight size={12} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayKey = calendarDayKey(day)
          const dayEntries = entriesByDay.get(dayKey) ?? []
          const kinds = uniqueKinds(dayEntries)
          const visible = kinds.slice(0, MAX_DOTS)
          const overflow = kinds.length - visible.length
          const isToday = isSameDay(day, today)

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => handleDayClick(day)}
              className="group flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-center transition-colors hover:border-zinc-200 hover:bg-zinc-50/80 dark:hover:border-white/10 dark:hover:bg-white/[0.03]"
              aria-label={`${day.getDate()} ${day.toLocaleDateString('pl-PL', { month: 'long' })}${dayEntries.length > 0 ? `, ${dayEntries.length} wpis(ów)` : ''}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-secondary">
                {formatWeekdayShort(day)}
              </span>
              <span
                className={[
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                  isToday
                    ? 'bg-[#1e293b] text-white dark:bg-[#D4AF37] dark:text-[#1e293b]'
                    : 'text-fg-primary',
                ].join(' ')}
              >
                {day.getDate()}
              </span>
              <div className="flex h-2 items-center justify-center gap-0.5">
                {visible.map((kind) => (
                  <span
                    key={kind}
                    aria-hidden
                    className={`block h-1.5 w-1.5 rounded-full ${CALENDAR_ENTRY_KIND_COLORS[kind].dot}`}
                  />
                ))}
                {overflow > 0 ? (
                  <span className="text-[8px] font-semibold tabular-nums text-fg-secondary">
                    +{overflow}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {!loading && total === 0 ? (
        <p className="mt-3 text-center text-xs text-fg-secondary">
          Czysty tydzień — żadnych odwołań ani zmian.
        </p>
      ) : null}
    </BaseCard>
  )
}
