/**
 * Pomocnicze funkcje wyszukiwarki informacji (czyste, testowane).
 */
import type { InfoEvent } from './types.js'
import { warsawDayKey } from './time.js'

export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 80

export function normalizeSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
}

/**
 * Wzorzec `ilike` bezpieczny dla filtra `or()` PostgREST: usuwa znaki
 * rozdzielające listę warunków i cytowania, ucieka `%`/`_`, blokuje `*`.
 * `null` gdy po oczyszczeniu zostaje za mało znaków.
 */
export function toIlikePattern(query: string): string | null {
  const cleaned = normalizeSearchQuery(query)
    .replace(/[,()"'*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length < MIN_QUERY_LENGTH) return null
  return `%${cleaned.replace(/[%_]/g, (ch) => `\\${ch}`)}%`
}

/** Kolejność wyników z rankingu wyszukiwarki; elementy spoza listy id odpadają. */
export function orderByIds<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const out: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item) {
      out.push(item)
      byId.delete(id)
    }
  }
  return out
}

/** Najpierw nadchodzące (rosnąco), potem minione (od najnowszych). */
export function orderEventSearchResults(events: readonly InfoEvent[], now: Date): InfoEvent[] {
  const today = warsawDayKey(now)
  const upcoming = events.filter((e) => e.dayKey >= today).sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  const past = events.filter((e) => e.dayKey < today).sort((a, b) => b.dayKey.localeCompare(a.dayKey))
  return [...upcoming, ...past]
}
