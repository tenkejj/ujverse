/**
 * Czas w warstwie informacyjnej — zawsze Europe/Warsaw dla etykiet, UTC w danych.
 *
 * Różnice dni liczymy na kalendarzu warszawskim (klucze `YYYY-MM-DD`
 * zamieniane na północ UTC), więc zmiana czasu nie przesuwa „jutra".
 */

export const WARSAW_TZ = 'Europe/Warsaw'

const LOCALE = 'pl-PL'
export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WARSAW_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  day: 'numeric',
  month: 'short',
})
const dayMonthYearFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  weekday: 'short',
})
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const fullFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const monthShortFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: WARSAW_TZ,
  month: 'short',
})

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function warsawDayKey(date: Date): string {
  const parts = dayKeyFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function dayKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map((n) => Number.parseInt(n, 10))
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

/** Południe UTC danego dnia — bezpieczny punkt do formatowania samej daty w Warszawie. */
export function dayKeyToDate(key: string): Date {
  return new Date(dayKeyToUtcMs(key) + 12 * HOUR_MS)
}

/** Liczba dni kalendarzowych (Warszawa) od `from` do `to`. */
export function warsawDayDiff(from: Date, to: Date): number {
  return Math.round((dayKeyToUtcMs(warsawDayKey(to)) - dayKeyToUtcMs(warsawDayKey(from))) / DAY_MS)
}

export function dayKeyDiff(fromKey: string, toKey: string): number {
  return Math.round((dayKeyToUtcMs(toKey) - dayKeyToUtcMs(fromKey)) / DAY_MS)
}

export function pluralPL(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  if (abs === 1) return one
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** „12 lis" w bieżącym roku, „12 lis 2027" w innym. */
export function formatDate(date: Date, now: Date = new Date()): string {
  const sameYear = warsawDayKey(date).slice(0, 4) === warsawDayKey(now).slice(0, 4)
  return (sameYear ? dayMonthFormatter : dayMonthYearFormatter).format(date)
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date)
}

export function formatDateTime(date: Date, now: Date = new Date()): string {
  return `${formatDate(date, now)}, ${formatTime(date)}`
}

/** Pełny opis do atrybutu `title` (np. „środa, 4 listopada 2026 21:45"). */
export function formatFull(date: Date): string {
  return fullFormatter.format(date)
}

export function formatMonthShort(date: Date): string {
  return monthShortFormatter.format(date).replace('.', '')
}

export function formatDayOfMonth(date: Date): string {
  return warsawDayKey(date).slice(8, 10).replace(/^0/, '')
}

/** „przed chwilą", „15 min temu", „3 godz. temu", „wczoraj, 09:12", „4 dni temu", „12 paź". */
export function formatRelativePast(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime()
  if (diff < 2 * MINUTE_MS) {
    return diff > -5 * MINUTE_MS ? 'przed chwilą' : formatDate(date, now)
  }
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min temu`
  const days = warsawDayDiff(date, now)
  if (days <= 0) return `${Math.floor(diff / HOUR_MS)} godz. temu`
  if (days === 1) return `wczoraj, ${formatTime(date)}`
  if (days < 7) return `${days} ${pluralPL(days, 'dzień', 'dni', 'dni')} temu`
  return formatDate(date, now)
}

/** Czas do terminu: „40 min", „5 godz.", „3 dni". Wartości ujemne traktujemy jak zero. */
export function formatDurationShort(ms: number): string {
  const safe = Math.max(0, ms)
  if (safe < HOUR_MS) return `${Math.max(1, Math.ceil(safe / MINUTE_MS))} min`
  if (safe < DAY_MS) return `${Math.floor(safe / HOUR_MS)} godz.`
  const days = Math.floor(safe / DAY_MS)
  return `${days} ${pluralPL(days, 'dzień', 'dni', 'dni')}`
}

/** Etykieta dnia wydarzenia: „Dziś", „Jutro", „pt., 21 lis" lub z rokiem. */
export function formatDayLabel(dayKey: string, now: Date = new Date()): string {
  const diff = dayKeyDiff(warsawDayKey(now), dayKey)
  if (diff === 0) return 'Dziś'
  if (diff === 1) return 'Jutro'
  if (diff === -1) return 'Wczoraj'
  const date = dayKeyToDate(dayKey)
  return `${weekdayFormatter.format(date)}, ${formatDate(date, now)}`
}
