/**
 * UJverse — helpers pod siatkę kalendarza akademickiego (widok miesiąca).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Konwencja: tydzień zaczyna się od PONIEDZIAŁKU (pl-PL).
 * Zwracamy ZAWSZE 42 dni (6 tygodni × 7 dni) — stabilna wysokość grid'u,
 * brak skoków layoutu przy zmianie miesiąca.
 */

const DAYS_IN_GRID = 42

/**
 * Generuje 42 daty pokrywające widok miesiąca.
 *
 * Algorytm:
 *  - Wstart = 1 dzień miesiąca,
 *  - cofnij do najbliższego poniedziałka (włącznie),
 *  - dodaj 42 dni.
 *
 * Wszystkie daty mają `00:00:00` w lokalnej strefie czasowej.
 */
export function getMonthGridDays(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  // JS Date: niedziela = 0, poniedziałek = 1. Chcemy cofnąć do poniedziałka.
  const weekday = first.getDay()
  const offsetToMonday = weekday === 0 ? 6 : weekday - 1
  const start = new Date(first)
  start.setDate(start.getDate() - offsetToMonday)
  start.setHours(0, 0, 0, 0)

  const days: Date[] = []
  for (let i = 0; i < DAYS_IN_GRID; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

/** Pierwszy moment widocznego zakresu (poniedziałek tygodnia z 1 dniem miesiąca). */
export function getMonthGridRangeStart(viewMonth: Date): Date {
  return getMonthGridDays(viewMonth)[0]!
}

/** Ostatni moment widocznego zakresu (niedziela 6. tygodnia, koniec dnia). */
export function getMonthGridRangeEnd(viewMonth: Date): Date {
  const last = getMonthGridDays(viewMonth)[DAYS_IN_GRID - 1]!
  const end = new Date(last)
  end.setHours(23, 59, 59, 999)
  return end
}

/** Czy dwie daty wpadają na ten sam dzień kalendarzowy (w lokalnym TZ). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Czy data wpada w aktualnie wyświetlany miesiąc (a nie w padding). */
export function isInViewMonth(day: Date, viewMonth: Date): boolean {
  return day.getMonth() === viewMonth.getMonth() && day.getFullYear() === viewMonth.getFullYear()
}

/** Polski label miesiąca z rokiem („czerwiec 2026"). */
export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
}

/** Skrócone nazwy dni tygodnia w pl-PL (Pn, Wt, Śr, Cz, Pt, Sb, Nd). */
export const WEEKDAY_SHORT_LABELS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'] as const

/** Przesuwa miesiąc o `delta` (np. -1 = poprzedni, +1 = następny). */
export function shiftMonth(viewMonth: Date, delta: number): Date {
  return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1)
}

/** Dzisiejszy dzień (00:00 lokalne). */
export function todayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
