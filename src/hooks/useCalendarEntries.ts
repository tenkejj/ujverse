/**
 * UJverse — useCalendarEntries: stan wpisów kalendarza dla zadanego zakresu
 * + Realtime z refetchem.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Filozofia:
 *   - Hook trzyma listę dla DOKŁADNIE jednego zakresu (np. miesiąc wyświetlany
 *     w MonthGrid). Zmiana zakresu (`rangeStart` / `rangeEnd`) → refetch.
 *   - Realtime sygnał na całej tabeli (taniej niż per-zakres filter)
 *     → triggerujemy refetch tylko jeśli aktualny widok jest „świeży"
 *       (`isStale = false`); w przeciwnym razie i tak już lecimy z fetch'em.
 *   - Filtry (`kinds`, `lecturerKeys`, `departments`) są readonly arraye —
 *     hook polega na referencyjnej stabilności wywołującego. UI używa
 *     `useMemo` na filtrach, nie reallokuje przy każdym renderze.
 *   - Brak optymistyki: kalendarz jest read-only z perspektywy UI w v1.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataService } from '../services/DataService'
import type {
  CalendarEntry,
  CalendarEntryKind,
  CalendarSearchFilters,
} from '../types/calendar'

type Params = {
  rangeStart: Date
  rangeEnd: Date
  filters?: CalendarSearchFilters
  /** Domyślnie `true` — wyłącz gdy widok nie jest aktywny (oszczędność quota). */
  enabled?: boolean
}

export type UseCalendarEntriesResult = {
  entries: CalendarEntry[]
  loading: boolean
  error: string | null
  /** Force refetch bez zmiany parametrów (np. po user action „odśwież"). */
  refresh: () => Promise<void>
}

/**
 * Stabilny klucz cache'a dla pary (zakres, filtry).
 *
 * Nie używamy `JSON.stringify` na `filters` żeby uniknąć kosztu serializacji
 * w hot-path; składamy ręcznie z deterministyczną kolejnością. To NIE jest
 * cache między rerenderami (re-fetch i tak idzie), tylko deduplikator
 * Realtime triggera w tym samym oknie czasowym.
 */
function buildKey(
  rangeStart: Date,
  rangeEnd: Date,
  filters: CalendarSearchFilters | undefined,
): string {
  const kinds = filters?.kinds ? [...filters.kinds].sort().join(',') : ''
  const lecturers = filters?.lecturerKeys ? [...filters.lecturerKeys].sort().join(',') : ''
  const departments = filters?.departments ? [...filters.departments].sort().join(',') : ''
  return `${rangeStart.getTime()}|${rangeEnd.getTime()}|${kinds}|${lecturers}|${departments}`
}

export function useCalendarEntries({
  rangeStart,
  rangeEnd,
  filters,
  enabled = true,
}: Params): UseCalendarEntriesResult {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqIdRef = useRef(0)
  const debounceRef = useRef<number | null>(null)

  const cacheKey = useMemo(
    () => buildKey(rangeStart, rangeEnd, filters),
    [rangeStart, rangeEnd, filters],
  )

  const refresh = useCallback(async () => {
    if (!enabled) return
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await DataService.listCalendarEntries({
        rangeStart,
        rangeEnd,
        filters,
      })
      if (reqId !== reqIdRef.current) return
      setEntries(data)
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      const message = err instanceof Error ? err.message : 'Nie udało się pobrać kalendarza.'
      setError(message)
      setEntries([])
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, rangeStart, rangeEnd, filters])

  // Initial + refetch przy zmianie zakresu / filtrów.
  useEffect(() => {
    void refresh()
    // cacheKey dodajemy do deps żeby zmiana referencji filters.kinds
    // (np. user kliknie inny pill) wywołała refetch. refresh i tak
    // domyka się po nowych params via useCallback.
  }, [refresh, cacheKey])

  // Realtime — debounced refetch.
  // Wzór: pierwsze zdarzenie → start timera 800ms; każde kolejne resetuje
  // timer. Burst INSERT-ów (scraper wrzuca 20 wpisów w sekundę) = 1 refetch
  // zamiast 20.
  useEffect(() => {
    if (!enabled) return
    const unsubscribe = DataService.subscribeCalendar(() => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        void refresh()
      }, 800)
    })
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      unsubscribe()
    }
  }, [enabled, refresh])

  return useMemo(
    () => ({ entries, loading, error, refresh }),
    [entries, loading, error, refresh],
  )
}

/**
 * Pomocnik widoku: grupuje wpisy po dniu lokalnym (klucz `YYYY-MM-DD`).
 *
 * Wielodniowe wpisy (np. urlop wykładowcy 15-20.06) są DUBLOWANE per dzień
 * w które się rozciągają — to świadome, widok miesiąca chce zobaczyć kropkę
 * w każdym dniu objętym wpisem. Inaczej grupowanie po `starts_at` ucinałoby
 * widoczność po pierwszym dniu.
 *
 * Klucz formatu `YYYY-MM-DD` jest sortowalny leksykograficznie i pasuje
 * do `Intl.DateTimeFormat` w UI bez dodatkowej konwersji.
 */
export function groupCalendarEntriesByDay(
  entries: readonly CalendarEntry[],
): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const start = new Date(entry.starts_at)
    const end = new Date(entry.ends_at)
    if (Number.isNaN(start.getTime())) continue
    const lastDay = Number.isNaN(end.getTime()) ? start : end

    // Iteracja od dnia startu do dnia końca (włącznie). Maksymalnie 60 dni
    // żeby błędny rekord (rok 2099) nie wywalił widoku.
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const limit = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate())
    let iterations = 0
    while (cursor.getTime() <= limit.getTime() && iterations < 60) {
      const key = formatDayKey(cursor)
      const bucket = out.get(key)
      if (bucket) {
        bucket.push(entry)
      } else {
        out.set(key, [entry])
      }
      cursor.setDate(cursor.getDate() + 1)
      iterations += 1
    }
  }
  return out
}

/** Sortuje kindy w ramach jednego dnia wedle priorytetu wizualnego. */
export function sortEntriesForDay(entries: readonly CalendarEntry[]): CalendarEntry[] {
  const priority: Record<CalendarEntryKind, number> = {
    deadline: 0,
    class_cancelled: 1,
    lecturer_absence: 2,
    class_rescheduled: 3,
    class_remote: 4,
    duty_change: 5,
    free_day: 6,
    official_event: 7,
    community_event: 8,
  }
  return [...entries].sort((a, b) => {
    const pa = priority[a.kind] ?? 99
    const pb = priority[b.kind] ?? 99
    if (pa !== pb) return pa - pb
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  })
}

function formatDayKey(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0')
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Re-export dla UI (np. MonthGrid generuje klucz dnia w ten sam sposób). */
export const calendarDayKey = formatDayKey
