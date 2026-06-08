import type { UJEvent } from '../data/mockEvents'

export const EVENTS_WITH_AUTHOR_SELECT = '*, profiles(*)'

type EventRow = {
  id: string | number
  user_id?: string | null
  title?: string | null
  date?: string | null
  category?: string | null
  location?: string | null
  description?: string | null
  attendees?: number | null
  image_url?: string | null
  map_url?: string | null
  attendee_avatars?: string[] | null
  external_id?: string | null
  source_name?: string | null
  is_official?: boolean | null
  event_url?: string | null
  faculty?: 'WZiKS' | 'Uniwersytet Jagielloński' | null
  ingest_from_fallback?: boolean | null
  profiles?: EventAuthorRow | EventAuthorRow[] | null
}

type EventAuthorRow = {
  id?: string | null
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
}

const PAST_QUERY_KEYWORDS = [
  'minione',
  'archiwum',
  'przeszłe',
  'przeszle',
  'zakończone',
  'zakonczone',
] as const

export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Heurystyka: użytkownik jawnie szuka przeszłych wydarzeń. */
export function queryImpliesPastEvents(query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return false
  return PAST_QUERY_KEYWORDS.some((kw) => normalized.includes(kw))
}

export function escapeIlikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

export function normalizeEventAuthor(raw: unknown): UJEvent['author'] | undefined {
  if (!raw) return undefined
  const candidate = Array.isArray(raw) ? raw[0] : raw
  if (!candidate || typeof candidate !== 'object') return undefined
  const row = candidate as EventAuthorRow
  if (typeof row.id !== 'string' || row.id.length === 0) return undefined
  return {
    id: row.id,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    username: typeof row.username === 'string' ? row.username : null,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
  }
}

/**
 * Oficjalne na górze, potem **rosnąco** po dacie (najbliższe nadchodzące na czele).
 *
 * Historia: pierwotnie ASC → przesunięte na DESC (8 czerwca 2026, brief "Sortowanie
 * wydarzeń malejąco") → cofnięte na ASC po testach UI (4.10.2026 lądował na górze
 * zamiast "co dziś"). Konsumenci modułu (student otwiera "Wydarzenia" by zobaczyć
 * najbliższe wykłady) potrzebują kolejności "co najbliżej" — DESC pasował tylko do
 * narracji katalogowej. Patrz też `useEvents.refetchDbEvents`
 * (`.order('date', { ascending: true })`) i `EventIngestor.fetchOfficialFromSupabase`.
 */
export function compareOfficialThenDate(a: UJEvent, b: UJEvent): number {
  const oa = a.is_official ? 0 : 1
  const ob = b.is_official ? 0 : 1
  if (oa !== ob) return oa - ob
  return a.date.getTime() - b.date.getTime()
}

export function eventMatchesTextQuery(ev: UJEvent, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return false
  const title = (ev.title ?? '').toLowerCase()
  const location = (ev.location ?? '').toLowerCase()
  const description = (ev.description ?? '').toLowerCase()
  return (
    title.includes(normalized) ||
    location.includes(normalized) ||
    description.includes(normalized)
  )
}

export function eventPassesDateFilter(ev: UJEvent, includePast: boolean): boolean {
  if (includePast) return true
  const start = new Date(startOfTodayIso())
  return ev.date.getTime() >= start.getTime()
}

export function eventFromDbRow(raw: unknown): UJEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as EventRow
  if (import.meta.env.DEV) {
    console.log('[Debug Events] Raw row from DB:', row)
  }
  const src = raw as Record<string, unknown>
  const id = row.id
  if (typeof id !== 'string' && typeof id !== 'number') {
    console.error('[useEvents] dropped event row: invalid id', raw)
    return null
  }
  const title = typeof row.title === 'string' ? row.title : null
  const dateRaw = typeof row.date === 'string' ? row.date : null
  if (!title || title.trim().length === 0) {
    console.error('[useEvents] dropped event row: missing title', raw)
    return null
  }
  if (!dateRaw || dateRaw.trim().length === 0) {
    console.error('[useEvents] dropped event row: missing date', raw)
    return null
  }
  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) {
    console.error('[useEvents] dropped event row: invalid date', raw)
    return null
  }
  const imageUrl =
    typeof row.image_url === 'string'
      ? row.image_url
      : typeof src.imageUrl === 'string'
        ? src.imageUrl
        : ''
  const mapUrl =
    typeof row.map_url === 'string' ? row.map_url : typeof src.mapUrl === 'string' ? src.mapUrl : ''
  const rawAuthor = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles || null)
  if (import.meta.env.DEV && !rawAuthor && row.user_id) {
    console.error('[CRITICAL JOIN FAIL] Brak profilu dla wydarzenia!', {
      eventId: row.id,
      userId: row.user_id,
      rawRow: row,
    })
  }
  const author = normalizeEventAuthor(rawAuthor)

  return {
    id: String(id),
    user_id: typeof row.user_id === 'string' && row.user_id.length > 0 ? row.user_id : undefined,
    author,
    title,
    date,
    category: typeof row.category === 'string' ? row.category : 'Wydarzenie',
    location: typeof row.location === 'string' ? row.location : '',
    description: typeof row.description === 'string' ? row.description : '',
    attendees: typeof row.attendees === 'number' && Number.isFinite(row.attendees) ? row.attendees : 0,
    isAttending: false,
    imageUrl: imageUrl.length > 0 ? imageUrl : undefined,
    mapUrl: mapUrl.length > 0 ? mapUrl : undefined,
    attendeeAvatars: Array.isArray(row.attendee_avatars)
      ? row.attendee_avatars.filter((u): u is string => typeof u === 'string')
      : undefined,
    external_id:
      typeof row.external_id === 'string' && row.external_id.length > 0 ? row.external_id : undefined,
    source_name:
      typeof row.source_name === 'string' && row.source_name.length > 0 ? row.source_name : undefined,
    is_official: typeof row.is_official === 'boolean' ? row.is_official : false,
    event_url: typeof row.event_url === 'string' && row.event_url.length > 0 ? row.event_url : undefined,
    faculty: row.faculty === 'WZiKS' || row.faculty === 'Uniwersytet Jagielloński' ? row.faculty : undefined,
    ingest_from_fallback:
      typeof row.ingest_from_fallback === 'boolean' ? row.ingest_from_fallback : undefined,
  }
}

function eventDedupKey(event: UJEvent): string {
  if (event.external_id) return `ext:${event.external_id}`
  return `id:${event.id}`
}

export function mergeEventLists(sources: UJEvent[][]): UJEvent[] {
  const map = new Map<string, UJEvent>()
  for (const source of sources) {
    for (const event of source) {
      map.set(eventDedupKey(event), event)
    }
  }
  return Array.from(map.values()).sort(compareOfficialThenDate)
}
