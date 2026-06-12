/**
 * UJverse — MonthGrid: 7×6 siatka miesiąca z kolorowymi kropkami per kind.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Każda komórka:
 *  - data dnia (number),
 *  - max 3 kropki (po jednej na unikalny kind w tym dniu),
 *  - jeśli kindów >3 → ostatnia kropka jako „+N",
 *  - dni „spoza miesiąca" są przyciemnione (`text-fg-secondary opacity-50`),
 *  - „dziś" ma gradient-ring,
 *  - aktywnie wybrany dzień ma akcent border.
 *
 * Komponent jest CZYSTO PREZENTACYJNY — żadnych fetchy, żadnych transformacji
 * z czasem. Dostaje gotową mapę `entriesByDay` z hook'a.
 */
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  type CalendarEntry,
  type CalendarEntryKind,
} from '../../types/calendar'
import {
  isInViewMonth,
  isSameDay,
  todayLocal,
  WEEKDAY_SHORT_LABELS_PL,
} from '../../lib/calendarGrid'
import { calendarDayKey } from '../../hooks/useCalendarEntries'

type Props = {
  /** 42 daty (6 tygodni × 7 dni). Generowane przez `getMonthGridDays`. */
  days: Date[]
  viewMonth: Date
  selectedDay: Date | null
  entriesByDay: Map<string, CalendarEntry[]>
  onSelectDay: (day: Date) => void
}

const MAX_DOTS_PER_CELL = 3

/** Wyciąga unikalne kindy z dnia, sortuje wg priorytetu wizualnego. */
function uniqueKinds(entries: readonly CalendarEntry[]): CalendarEntryKind[] {
  const seen = new Set<CalendarEntryKind>()
  for (const e of entries) seen.add(e.kind)
  return Array.from(seen)
}

export default function MonthGrid({
  days,
  viewMonth,
  selectedDay,
  entriesByDay,
  onSelectDay,
}: Props) {
  const today = useMemo(() => todayLocal(), [])

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/80">
      {/* Nagłówek dni tygodnia */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60 dark:border-white/10 dark:bg-white/[0.03]">
        {WEEKDAY_SHORT_LABELS_PL.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-fg-secondary"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Siatka dni — grid 7 kolumn */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayKey = calendarDayKey(day)
          const entries = entriesByDay.get(dayKey) ?? []
          const kinds = uniqueKinds(entries)
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const isOutsideMonth = !isInViewMonth(day, viewMonth)

          const visibleKinds = kinds.slice(0, MAX_DOTS_PER_CELL)
          const overflow = kinds.length - visibleKinds.length

          return (
            <motion.button
              key={dayKey}
              type="button"
              onClick={() => onSelectDay(day)}
              whileTap={{ scale: 0.96 }}
              className={[
                'group relative flex aspect-square min-h-[56px] flex-col items-center justify-between p-1.5 sm:p-2 text-left transition-colors',
                'border-b border-r border-zinc-100 dark:border-white/[0.04]',
                isOutsideMonth ? 'opacity-40' : '',
                isSelected
                  ? 'bg-[#1e293b]/[0.05] dark:bg-[#D4AF37]/[0.08]'
                  : 'hover:bg-zinc-50/80 dark:hover:bg-white/[0.03]',
              ].join(' ')}
              aria-pressed={isSelected}
              aria-label={`${day.getDate()} ${day.toLocaleDateString('pl-PL', { month: 'long' })}${entries.length > 0 ? `, ${entries.length} wpis(ów)` : ''}`}
            >
              {/* Numer dnia */}
              <div className="flex w-full items-start justify-between">
                <span
                  className={[
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:h-7 sm:w-7 sm:text-sm',
                    isToday
                      ? 'bg-[#1e293b] text-white shadow-sm dark:bg-[#D4AF37] dark:text-[#1e293b]'
                      : isSelected
                        ? 'text-[#1e293b] dark:text-[#D4AF37]'
                        : 'text-fg-primary',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
                {entries.length > 0 ? (
                  <span className="hidden text-[10px] font-medium tabular-nums text-fg-secondary sm:inline">
                    {entries.length}
                  </span>
                ) : null}
              </div>

              {/* Kropki kindów */}
              {visibleKinds.length > 0 ? (
                <div className="mt-auto flex w-full items-center justify-center gap-0.5 sm:gap-1">
                  {visibleKinds.map((kind) => (
                    <span
                      key={kind}
                      aria-hidden
                      className={`block h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${CALENDAR_ENTRY_KIND_COLORS[kind].dot}`}
                    />
                  ))}
                  {overflow > 0 ? (
                    <span
                      className="ml-0.5 text-[9px] font-semibold tabular-nums text-fg-secondary sm:text-[10px]"
                      aria-label={`i ${overflow} więcej kategorii`}
                    >
                      +{overflow}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div aria-hidden className="h-2" />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
