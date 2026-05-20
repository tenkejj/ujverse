/**
 * searchHistory — wspólne źródło prawdy dla historii wyszukiwania w UJverse.
 *
 * Klucz `ujverse_search_history_v1` jest dzielony między mobilnym SearchBar,
 * dedykowaną stroną SearchPageView i nowym OmniSearchHub v2. Centralizacja
 * eliminuje wcześniejszą duplikację `loadSearchHistory` / `saveSearchHistory`
 * w obu komponentach.
 */

export const HISTORY_KEY = 'ujverse_search_history_v1'
export const MAX_HISTORY = 12
/** Ile pozycji widać w dropdownie OmniSearchHub (System 4). */
export const RECENT_VISIBLE = 3

function safeParse(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch {
    return []
  }
}

export function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    return safeParse(raw).slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}

function persist(entries: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Wstawia frazę na początek (deduplikuje case-insensitive). Zwraca nową listę. */
export function pushHistoryEntry(prev: string[], query: string): string[] {
  const t = query.trim()
  if (t.length < 2) return prev
  const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_HISTORY)
  persist(next)
  return next
}

export function removeHistoryEntry(prev: string[], entry: string): string[] {
  const next = prev.filter((x) => x !== entry)
  persist(next)
  return next
}

export function clearAllHistory(): string[] {
  persist([])
  return []
}
