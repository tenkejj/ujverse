/**
 * Hooki warstwy informacyjnej (TanStack Query).
 *
 * Komunikaty są kluczowane wydziałem — odpowiedź dla poprzedniego wyboru
 * trafia do własnego wpisu cache i nie nadpisze bieżącego. Rejestracje i
 * wydarzenia pobieramy raz (ograniczona lista) i filtrujemy po stronie klienta.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { DataService, type PublicSearchResults } from '../services/DataService'
import { matchesFaculty } from '../lib/info/faculty'
import { MIN_QUERY_LENGTH, normalizeSearchQuery } from '../lib/info/search'
import type { DomainResult, InfoAnnouncement } from '../lib/info/types'

export const INFO_QUERY_KEYS = {
  announcements: (faculty: string | null) => ['info', 'announcements', faculty ?? 'all'] as const,
  registrations: ['info', 'registrations'] as const,
  events: ['info', 'events'] as const,
  search: (query: string, faculty: string | null) => ['info', 'search', query.toLowerCase(), faculty ?? 'all'] as const,
}

export function usePublicAnnouncements(faculty: string | null) {
  return useQuery<DomainResult<InfoAnnouncement>>({
    queryKey: INFO_QUERY_KEYS.announcements(faculty),
    queryFn: ({ signal }) => DataService.listPublicAnnouncements({ faculty, signal }),
    staleTime: 2 * 60_000,
    retry: 1,
    // Przy zmianie wydziału pokazujemy od razu przefiltrowane dane z poprzedniego
    // widoku (jeśli coś pasuje) — bez mignięcia pustego stanu.
    placeholderData: (previous) => {
      if (!previous) return undefined
      const items = previous.items.filter((item) => matchesFaculty(item.faculty, faculty))
      return items.length > 0 ? { ...previous, items } : undefined
    },
  })
}

export function usePublicRegistrations() {
  return useQuery({
    queryKey: INFO_QUERY_KEYS.registrations,
    queryFn: ({ signal }) => DataService.listPublicRegistrations({ signal }),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function usePublicOfficialEvents() {
  return useQuery({
    queryKey: INFO_QUERY_KEYS.events,
    queryFn: ({ signal }) => DataService.listPublicOfficialEvents({ signal }),
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function usePublicSearch(rawQuery: string, faculty: string | null) {
  const query = normalizeSearchQuery(rawQuery)
  const debounced = useDebouncedValue(query, 250)
  const enabled = debounced.length >= MIN_QUERY_LENGTH
  const result = useQuery<PublicSearchResults>({
    queryKey: INFO_QUERY_KEYS.search(debounced, faculty),
    queryFn: ({ signal }) => DataService.searchPublicInfo(debounced, { faculty, signal }),
    enabled,
    staleTime: 60_000,
    retry: 0,
    placeholderData: keepPreviousData,
  })
  return {
    ...result,
    query,
    debouncedQuery: debounced,
    enabled,
    isTyping: query !== debounced,
  }
}
