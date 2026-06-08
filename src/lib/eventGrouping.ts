/**
 * Grupowanie wydarzeń w bukety czasowe pod sekcje w `EventsView` (hub).
 *
 * Cztery bukety:
 *  - `today`     — dzisiaj (00:00 - 23:59 lokalnie)
 *  - `thisWeek`  — najbliższe 7 dni (poza dziś)
 *  - `thisMonth` — do końca bieżącego miesiąca (poza powyższe)
 *  - `later`     — wszystko dalsze
 *
 * Funkcja jest **czysta**: bukety są sortowane tym samym kluczem co reszta
 * modułu (`compareOfficialThenDate` — oficjalne pierwsze, potem ASC po dacie).
 *
 * Sygnatura zwraca tablicę zachowującą stałą kolejność bukietów (nie mapę),
 * więc widok może iterować i pomijać puste sekcje bez sortowania.
 */

import type { UJEvent } from '../data/mockEvents'
import { compareOfficialThenDate } from './eventRow'

export type EventTimeBucket = 'today' | 'thisWeek' | 'thisMonth' | 'later'

export type EventGroup = {
  bucket: EventTimeBucket
  /** Etykieta sekcji w UI ("Dziś", "Ten tydzień", ...). */
  label: string
  /** Mała pomocnicza linia ("dziś 8 czerwca", "do niedzieli 14.06"). */
  subtitle: string
  events: UJEvent[]
}

const BUCKET_ORDER: EventTimeBucket[] = ['today', 'thisWeek', 'thisMonth', 'later']

const PL_DAY_NAMES = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
] as const

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday(): Date {
  const d = startOfToday()
  d.setHours(23, 59, 59, 999)
  return d
}

function endOfNextSevenDays(): Date {
  const d = startOfToday()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 59, 999)
  return d
}

function endOfThisMonth(): Date {
  const d = startOfToday()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

function bucketForDate(date: Date): EventTimeBucket {
  const t = date.getTime()
  if (t <= endOfToday().getTime()) return 'today'
  if (t <= endOfNextSevenDays().getTime()) return 'thisWeek'
  if (t <= endOfThisMonth().getTime()) return 'thisMonth'
  return 'later'
}

function formatDayShort(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function subtitleFor(bucket: EventTimeBucket): string {
  switch (bucket) {
    case 'today':
      return formatDayShort(startOfToday())
    case 'thisWeek': {
      const end = endOfNextSevenDays()
      return `do ${PL_DAY_NAMES[end.getDay()]} ${formatDayShort(end)}`
    }
    case 'thisMonth': {
      const end = endOfThisMonth()
      return `do końca ${formatDayShort(end).replace(/^\d+\s+/, '')}`
    }
    case 'later':
    default:
      return 'w dalszej przyszłości'
  }
}

function labelFor(bucket: EventTimeBucket): string {
  switch (bucket) {
    case 'today':
      return 'Dziś'
    case 'thisWeek':
      return 'Ten tydzień'
    case 'thisMonth':
      return 'W tym miesiącu'
    case 'later':
    default:
      return 'W przyszłości'
  }
}

/**
 * Dzieli wydarzenia na bukety czasowe. Wynik:
 *  - zachowuje kolejność bukietów: today → thisWeek → thisMonth → later,
 *  - w każdym bukiecie sortuje przez `compareOfficialThenDate` (oficjalne pierwsze, ASC),
 *  - pomija bukety puste (nie pojawiają się w wyniku).
 */
export function groupEventsByTimeBucket(events: UJEvent[]): EventGroup[] {
  const buckets: Record<EventTimeBucket, UJEvent[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
  }

  for (const ev of events) {
    buckets[bucketForDate(ev.date)].push(ev)
  }

  const groups: EventGroup[] = []
  for (const bucket of BUCKET_ORDER) {
    const items = buckets[bucket]
    if (items.length === 0) continue
    items.sort(compareOfficialThenDate)
    groups.push({
      bucket,
      label: labelFor(bucket),
      subtitle: subtitleFor(bucket),
      events: items,
    })
  }

  return groups
}

/** Liczbowe statystyki pod side-rail (X dziś, Y oficjalnych, Z łącznie). */
export type EventStats = {
  total: number
  official: number
  today: number
  thisWeek: number
}

export function computeEventStats(events: UJEvent[]): EventStats {
  const todayEnd = endOfToday().getTime()
  const weekEnd = endOfNextSevenDays().getTime()
  let official = 0
  let today = 0
  let thisWeek = 0
  for (const ev of events) {
    if (ev.is_official) official++
    const t = ev.date.getTime()
    if (t <= todayEnd) today++
    if (t <= weekEnd) thisWeek++
  }
  return { total: events.length, official, today, thisWeek }
}
