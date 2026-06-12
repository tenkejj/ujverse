/**
 * UJverse — CalendarView: pełny widok kalendarza akademickiego.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Trzyma stan miesiąca i wybranego dnia, łączy `useCalendarEntries`
 * (zakres = widoczne 6 tygodni) z prezentacją (MonthGrid + DayDrawer).
 *
 * Layout:
 *   - mobile: pojedyncza kolumna, drawer wchodzi z dołu (portal w body),
 *   - desktop (lg+): grid 1.6fr : 1fr → siatka po lewej, sticky panel po prawej.
 *
 * Filtry przyjdą w PR #5 — w v1 hook dostaje `undefined`, czyli „bez filtra".
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import {
  getMonthGridDays,
  getMonthGridRangeEnd,
  getMonthGridRangeStart,
  shiftMonth,
  todayLocal,
} from '../../lib/calendarGrid'
import {
  groupCalendarEntriesByDay,
  useCalendarEntries,
} from '../../hooks/useCalendarEntries'
import { useLecturerSubscriptionsContext } from '../../lib/lecturerSubscriptionsContext'
import type {
  CalendarEntryKind,
  CalendarSearchFilters,
} from '../../types/calendar'
import CalendarFilters from './CalendarFilters'
import CalendarLegend from './CalendarLegend'
import CalendarToolbar from './CalendarToolbar'
import DayDrawer, { DayPanelInline } from './DayDrawer'
import MonthGrid from './MonthGrid'

type Props = {
  /** Deep-link: jeśli podane (`YYYY-MM-DD`), otwieramy ten dzień na startcie
   *  i ustawiamy viewMonth na zawierający go miesiąc. Tylko mount-time. */
  initialSelectedDay?: string | null
}

function parseDayKey(key: string | null | undefined): Date | null {
  if (!key) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number.parseInt(m[1]!, 10)
  const mo = Number.parseInt(m[2]!, 10)
  const d = Number.parseInt(m[3]!, 10)
  const date = new Date(y, mo - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function CalendarView({ initialSelectedDay }: Props = {}) {
  const initialDay = useMemo(
    () => parseDayKey(initialSelectedDay),
    [initialSelectedDay],
  )

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (initialDay) {
      return new Date(initialDay.getFullYear(), initialDay.getMonth(), 1)
    }
    const t = todayLocal()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<Date | null>(initialDay)

  // Filtry — multi-select kindów + „tylko moi wykładowcy".
  const [selectedKinds, setSelectedKinds] = useState<Set<CalendarEntryKind>>(
    () => new Set(),
  )
  const [onlyMyLecturers, setOnlyMyLecturers] = useState(false)
  const lecturerCtx = useLecturerSubscriptionsContext()

  const toggleKind = useCallback((kind: CalendarEntryKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  const days = useMemo(() => getMonthGridDays(viewMonth), [viewMonth])
  const rangeStart = useMemo(() => getMonthGridRangeStart(viewMonth), [viewMonth])
  const rangeEnd = useMemo(() => getMonthGridRangeEnd(viewMonth), [viewMonth])

  // Składamy filtry do kontraktu RPC. Pusty Set → brak filtra (DB widzi NULL).
  // Stabilna referencja przez useMemo, żeby hook nie refetchował w kółko.
  const filters = useMemo<CalendarSearchFilters | undefined>(() => {
    const kinds = selectedKinds.size > 0 ? Array.from(selectedKinds) : undefined
    const lecturerKeys =
      onlyMyLecturers && lecturerCtx
        ? Array.from(lecturerCtx.subscribedKeys)
        : undefined
    if (!kinds && !lecturerKeys) return undefined
    return { kinds, lecturerKeys }
  }, [selectedKinds, onlyMyLecturers, lecturerCtx])

  const { entries, loading, error, refresh } = useCalendarEntries({
    rangeStart,
    rangeEnd,
    filters,
  })

  const entriesByDay = useMemo(
    () => groupCalendarEntriesByDay(entries),
    [entries],
  )

  // Gdy zmienia się miesiąc, czyść selekcję jeśli wybrany dzień wypada
  // poza nową widocznością.
  useEffect(() => {
    if (!selectedDay) return
    if (selectedDay < rangeStart || selectedDay > rangeEnd) {
      setSelectedDay(null)
    }
  }, [selectedDay, rangeStart, rangeEnd])

  const today = useMemo(() => todayLocal(), [])
  const isCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() &&
    viewMonth.getMonth() === today.getMonth()

  const handleToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(today)
  }

  // Inline panel po prawej: wybrany dzień LUB (default) najbliższy dzień
  // z wpisami — żeby user nie patrzył w pustkę po otwarciu kalendarza.
  const inlineDay = useMemo(() => {
    if (selectedDay) return selectedDay
    const todayKey = formatKey(today)
    if (entriesByDay.has(todayKey)) return today
    // Znajdź najbliższy dzień >= dziś z wpisami.
    const sorted = Array.from(entriesByDay.keys()).sort()
    const next = sorted.find((k) => k >= todayKey)
    if (next) {
      const [y, m, d] = next.split('-').map((s) => Number.parseInt(s, 10))
      return new Date(y, (m ?? 1) - 1, d)
    }
    return null
  }, [selectedDay, entriesByDay, today])

  const inlineDayEntries = useMemo(() => {
    if (!inlineDay) return []
    return entriesByDay.get(formatKey(inlineDay)) ?? []
  }, [inlineDay, entriesByDay])

  const drawerDayEntries = useMemo(() => {
    if (!selectedDay) return []
    return entriesByDay.get(formatKey(selectedDay)) ?? []
  }, [selectedDay, entriesByDay])

  return (
    <div className="space-y-4">
      <CalendarToolbar
        viewMonth={viewMonth}
        onPrev={() => setViewMonth((m) => shiftMonth(m, -1))}
        onNext={() => setViewMonth((m) => shiftMonth(m, +1))}
        onToday={handleToday}
        isCurrentMonth={isCurrentMonth}
      />

      <CalendarFilters
        selectedKinds={selectedKinds}
        onToggleKind={toggleKind}
        onlyMyLecturers={onlyMyLecturers}
        onToggleOnlyMyLecturers={setOnlyMyLecturers}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="space-y-3"
        >
          <MonthGrid
            days={days}
            viewMonth={viewMonth}
            selectedDay={selectedDay}
            entriesByDay={entriesByDay}
            onSelectDay={setSelectedDay}
          />
          <CalendarLegend />
          {error ? (
            <div className="rounded-xl border border-rose-300/60 bg-rose-50/70 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
              <button
                type="button"
                onClick={() => void refresh()}
                className="ml-2 underline underline-offset-2 hover:no-underline"
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : null}
          {!loading && entries.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-white/10">
              <Sparkles
                size={18}
                strokeWidth={2}
                className="mx-auto mb-2 text-fg-secondary"
                aria-hidden
              />
              <p className="text-sm font-semibold text-fg-primary">
                Pusty miesiąc.
              </p>
              <p className="mt-1 text-xs text-fg-secondary">
                Gdy w komunikatach pojawi się termin (przesunięcie zajęć,
                nieobecność, dyżur) — zobaczysz tu kropkę.
              </p>
            </div>
          ) : null}
        </motion.div>

        {/* Desktop inline panel */}
        <div className="hidden lg:block">
          <DayPanelInline day={inlineDay} entries={inlineDayEntries} />
        </div>
      </div>

      {/* Mobile bottom-sheet — portal w body */}
      <DayDrawer
        day={selectedDay}
        entries={drawerDayEntries}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  )
}

/** Lokalna kopia z useCalendarEntries.calendarDayKey — żeby uniknąć
 *  cyklicznych importów (CalendarView nie powinien zależeć od hook'a
 *  poza interfejsem publicznym). */
function formatKey(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0')
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}
