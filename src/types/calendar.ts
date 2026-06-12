/**
 * UJverse — typy domeny kalendarza akademickiego.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Lustrzane odbicie tabeli `public.calendar_entries` z migracji
 * 20260621100000_calendar_entries.sql. Trzymamy oddzielnie od `types/index.ts`,
 * żeby nie rozdmuchiwać legacy entrypointa — kalendarz importuje się
 * świadomie przez `from '../types/calendar'`.
 */

/**
 * Klasyfikacja wpisu kalendarza.
 *
 * Wszystkie wartości muszą się zgadzać z `kind` CHECK w SQL — Postgres
 * odrzuci INSERT z niepasującą wartością. Niektóre kindy są zarezerwowane
 * na fazy 2/3 (`free_day`, `community_event`, `deadline`) i nie są jeszcze
 * generowane przez triggery, ale typy gotowe pod rendering.
 */
export type CalendarEntryKind =
  | 'lecturer_absence'
  | 'class_cancelled'
  | 'class_remote'
  | 'class_rescheduled'
  | 'duty_change'
  | 'free_day'
  | 'official_event'
  | 'community_event'
  | 'deadline'

/** Kto/co wyprodukował wpis — pomocne przy debug i UI badges. */
export type CalendarExtractedBy = 'bielik' | 'trigger' | 'fixture' | 'manual'

/**
 * Zacieśniony podzbiór `CalendarEntryKind` — TYLKO kindy jakie BIELIK
 * generuje z `announcements.body` (zgodnie z `api/_lib/calendarExtraction.ts`
 * → `ALLOWED_KINDS`). Pozostałe kindy (`free_day`, `official_event`, itd.)
 * pochodzą z innych sourców i NIE pojawią się w `extracted_calendar`.
 *
 * Trzymamy zacieśnienie po stronie TS bo UI w `AnnouncementCard` rysuje
 * badge na podstawie `kind` i nie chcemy wyświetlać „Dzień wolny" gdyby
 * trigger DB kiedyś wciągnął tu coś z lewa.
 */
export type ExtractedCalendarKind = Extract<
  CalendarEntryKind,
  'lecturer_absence' | 'class_cancelled' | 'class_remote' | 'class_rescheduled' | 'duty_change'
>

/**
 * Lustrzane odbicie JSON-a w `announcements.extracted_calendar` (kolumna
 * JSONB). Schema dyktowana przez `api/_lib/calendarExtraction.ts`
 * → `CalendarExtraction`. `null` (cały obiekt) oznacza „Bielik nie znalazł
 * konkretnej daty" — odzwierciedlamy w kolumnie jako `JSONB null`.
 *
 * Trzymamy w `snake_case` 1:1 z JSON-em żeby uniknąć dodatkowej warstwy
 * mapowania w adapterze (PostgREST oddaje field-by-field).
 */
export type AnnouncementExtractedCalendar = {
  kind: ExtractedCalendarKind
  starts_at: string
  ends_at: string | null
  all_day: boolean
  location: string | null
  confidence: number
}

/**
 * Strażnik typu dla `extracted_calendar` z PostgREST. Świadomie luźny —
 * jeśli LLM/migracja wpiszą coś dziwnego, UI po prostu nie pokaże badge,
 * nie wybuchnie.
 */
export function isAnnouncementExtractedCalendar(
  raw: unknown,
): raw is AnnouncementExtractedCalendar {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  if (typeof r.kind !== 'string') return false
  if (typeof r.starts_at !== 'string' || r.starts_at.length === 0) return false
  const allowed: ExtractedCalendarKind[] = [
    'lecturer_absence',
    'class_cancelled',
    'class_remote',
    'class_rescheduled',
    'duty_change',
  ]
  return (allowed as string[]).includes(r.kind)
}

/**
 * Surowy wiersz z `public.calendar_entries` (rzut na PostgREST).
 *
 * `lecturer_key` jest GENERATED STORED po stronie DB — używamy go w hooku
 * do filtra „tylko moi wykładowcy" (O(1) lookup w `Set<string>` z
 * `useLecturerSubscriptions().subscribedKeys`).
 *
 * `time_range` jest GENERATED w DB ale nie zaciągamy go do klienta —
 * potrzebujemy tylko `starts_at` / `ends_at` do renderu, range służy
 * tylko indeksowi GiST po stronie SQL.
 */
export type CalendarEntry = {
  id: string
  kind: CalendarEntryKind
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  lecturer_name: string | null
  lecturer_key: string | null
  location: string | null
  department: string | null
  source_announcement_id: string | null
  source_official_event_id: string | null
  extracted_by: CalendarExtractedBy | null
  confidence: number | null
  created_at: string
}

/**
 * Filtry przekazywane do RPC `calendar_search`. Każde pole jest opcjonalne;
 * `undefined` / puste = bez filtra (DB zwraca wszystko z zakresu czasu).
 *
 * Trzymamy `kinds` / `lecturerKeys` / `departments` jako `readonly` żeby
 * hook mógł cachować referencję między re-renderami (React fast path).
 */
export type CalendarSearchFilters = {
  kinds?: readonly CalendarEntryKind[]
  lecturerKeys?: readonly string[]
  departments?: readonly string[]
}

/** Parametry pojedynczego zapytania o zakres (widok miesiąca / tygodnia). */
export type CalendarSearchParams = {
  rangeStart: Date
  rangeEnd: Date
  filters?: CalendarSearchFilters
  /** Max liczba wpisów (DB i tak twardo cap-uje do 2000). */
  limit?: number
}

/**
 * Etykiety pl-PL dla kindów — pojedyncze źródło prawdy dla UI i a11y.
 * UI komponenty (badge, legenda) ZAWSZE korzystają z tych stałych, nigdy
 * nie literalizują stringów. Wzór z `ANNOUNCEMENT_STATUS_LABEL`.
 */
export const CALENDAR_ENTRY_KIND_LABEL: Record<CalendarEntryKind, string> = {
  lecturer_absence: 'Nieobecność',
  class_cancelled: 'Zajęcia odwołane',
  class_remote: 'Zajęcia zdalne',
  class_rescheduled: 'Zmiana terminu',
  duty_change: 'Dyżur',
  free_day: 'Dzień wolny',
  official_event: 'Wydarzenie',
  community_event: 'Społeczność',
  deadline: 'Termin',
}

/**
 * Kolory dla kropek/badge w MonthGrid. Dobrane tak, żeby były czytelne
 * na light i dark theme; semantyka:
 *   - czerwony   = brakuje wykładowcy (absence / cancelled)
 *   - bursztyn   = zmiana logistyki (remote / rescheduled / duty)
 *   - zielony    = dzień wolny
 *   - błękit     = oficjalny event
 *   - fioletowy  = community
 *   - amarant    = deadline (kontrast, alarm)
 *
 * Wartości to klasy Tailwindowe (już używane w projekcie — zgodne ze
 * `theme.ts`). Trzymamy tu razem `dot` (kropka kalendarza) i `badge`
 * (chip w drawerze).
 */
export const CALENDAR_ENTRY_KIND_COLORS: Record<
  CalendarEntryKind,
  { dot: string; badge: string; badgeText: string }
> = {
  lecturer_absence: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/12 border-rose-500/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
  class_cancelled: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/12 border-red-500/40',
    badgeText: 'text-red-700 dark:text-red-300',
  },
  class_remote: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/12 border-amber-500/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  class_rescheduled: {
    dot: 'bg-amber-600',
    badge: 'bg-amber-600/12 border-amber-600/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  duty_change: {
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-500/12 border-yellow-500/40',
    badgeText: 'text-yellow-700 dark:text-yellow-300',
  },
  free_day: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/12 border-emerald-500/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  official_event: {
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/12 border-sky-500/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  community_event: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-500/12 border-violet-500/40',
    badgeText: 'text-violet-700 dark:text-violet-300',
  },
  deadline: {
    dot: 'bg-fuchsia-500',
    badge: 'bg-fuchsia-500/12 border-fuchsia-500/40',
    badgeText: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
}

/**
 * Strażnik typu na granicy z PostgREST.
 *
 * RPC zwraca `unknown` po deserializacji; sanitizujemy w jednym miejscu
 * przed wprowadzeniem do stanu. Brak walidacji Zod żeby nie wciągać runtime
 * kosztów do hot-path — kalendarz potrafi mieć 200+ wpisów na widok miesiąca.
 */
export function isCalendarEntry(raw: unknown): raw is CalendarEntry {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.kind === 'string' &&
    typeof r.title === 'string' &&
    typeof r.starts_at === 'string' &&
    typeof r.ends_at === 'string' &&
    typeof r.all_day === 'boolean' &&
    typeof r.created_at === 'string'
  )
}
