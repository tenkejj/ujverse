/**
 * Źródło oficjalnych wydarzeń UJ.
 *
 * Architektura (po refactorze): scraping jest wykonywany po stronie serwera
 * przez `api/scrape-uj-events.ts` (Vercel cron) i zapisywany do
 * `public.official_events`. Front czyta wyłącznie z Supabase. Lokalny cache
 * w `localStorage` (TTL 15 min) służy do natychmiastowego pierwszego rendera
 * i działania offline.
 *
 * Stąd nie ma już:
 *  - łańcucha proxy (vite-proxy → corsproxy.io → allorigins),
 *  - DOM-parsera HTML w przeglądarce,
 *  - błędów `ENOTFOUND wziks.uj.edu.pl` w devie.
 */
import type { UJEvent } from '../data/mockEvents'
import { materializeOfficialFallbackEvents } from '../data/officialFallbackEvents'
import { supabase } from '../supabaseClient'

const OFFICIAL_CACHE_KEY = 'ujverse_official_ingest_v1'
export const OFFICIAL_CACHE_TTL_MS = 15 * 60 * 1000

let syncPromise: Promise<IngestSyncResult> | null = null

const CATEGORY_OFFICIAL = 'Oficjalne'

export type IngestSyncResult = {
  events: UJEvent[]
  /** True gdy użyto zestawu awaryjnego (sieć/Supabase niedostępne, brak cache). */
  fromStaticFallback: boolean
}

export type IngestFaculty = 'WZiKS' | 'Uniwersytet Jagielloński'

type OfficialEventRow = {
  id: string
  external_id: string
  title: string
  date: string
  category: string | null
  location: string | null
  description: string | null
  faculty: string
  source_name: string
  event_url: string
  image_url: string | null
}

function rowToUjEvent(row: OfficialEventRow): UJEvent | null {
  if (!row.id || !row.title || !row.date) return null
  const date = new Date(row.date)
  if (Number.isNaN(date.getTime())) return null
  const faculty: IngestFaculty =
    row.faculty === 'WZiKS' ? 'WZiKS' : 'Uniwersytet Jagielloński'

  return {
    id: `ext:ingest:${row.external_id.replace(/[^a-zA-Z0-9:_-]/g, '_')}`,
    external_id: row.external_id,
    title: row.title,
    date,
    category: row.category ?? CATEGORY_OFFICIAL,
    location: row.location ?? '',
    description: row.description ?? 'Treść z oficjalnego serwisu UJ.',
    attendees: 0,
    is_official: true,
    faculty,
    source_name: row.source_name,
    event_url: row.event_url,
    imageUrl: row.image_url ?? undefined,
  }
}

function dedupeByExternalId(items: UJEvent[]): UJEvent[] {
  const map = new Map<string, UJEvent>()
  for (const e of items) {
    const key = e.external_id ?? e.id
    if (!map.has(key)) map.set(key, e)
  }
  return [...map.values()]
}

export function getStaticFallbackOfficialEvents(): UJEvent[] {
  return dedupeByExternalId(materializeOfficialFallbackEvents())
}

type CachedPayload = {
  ts: number
  events: Array<Record<string, unknown>>
}

function serializeOfficial(e: UJEvent): Record<string, unknown> {
  return {
    ...e,
    date: e.date.toISOString(),
  }
}

function reviveFromCache(raw: Record<string, unknown>): UJEvent | null {
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  const d = raw.date
  const date =
    typeof d === 'string' ? new Date(d) : d instanceof Date ? d : null
  if (!date || Number.isNaN(date.getTime())) return null
  const ev: UJEvent = {
    id: raw.id,
    title: raw.title,
    date,
    category: typeof raw.category === 'string' ? raw.category : CATEGORY_OFFICIAL,
    location: typeof raw.location === 'string' ? raw.location : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    attendees: typeof raw.attendees === 'number' ? raw.attendees : 0,
    is_official: true,
  }
  if (typeof raw.external_id === 'string') ev.external_id = raw.external_id
  if (typeof raw.source_name === 'string') ev.source_name = raw.source_name
  if (typeof raw.event_url === 'string') ev.event_url = raw.event_url
  if (typeof raw.imageUrl === 'string') ev.imageUrl = raw.imageUrl
  if (typeof raw.faculty === 'string') ev.faculty = raw.faculty as UJEvent['faculty']
  if (typeof raw.ingest_from_fallback === 'boolean') {
    ev.ingest_from_fallback = raw.ingest_from_fallback
  }
  return ev
}

export function readOfficialEventsFromCache(): UJEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OFFICIAL_CACHE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as CachedPayload
    if (typeof data.ts !== 'number' || !Array.isArray(data.events)) return []
    if (Date.now() - data.ts > OFFICIAL_CACHE_TTL_MS) return []
    return data.events
      .map((o) => reviveFromCache(o))
      .filter((e): e is UJEvent => e !== null)
  } catch {
    return []
  }
}

function writeOfficialCache(events: UJEvent[]) {
  try {
    const payload: CachedPayload = {
      ts: Date.now(),
      events: events.map(serializeOfficial),
    }
    localStorage.setItem(OFFICIAL_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

function readStaleOfficialFromStorage(): UJEvent[] {
  try {
    const raw = localStorage.getItem(OFFICIAL_CACHE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as CachedPayload
    if (!Array.isArray(data.events)) return []
    return data.events
      .map((o) => reviveFromCache(o))
      .filter((e): e is UJEvent => e !== null)
  } catch {
    return []
  }
}

/** Ostatni znany zestaw oficjalnych (świeży cache lub przeterminowany — pod pierwszy render). */
export function hydrateOfficialEventsFromStorage(): UJEvent[] {
  const fresh = readOfficialEventsFromCache()
  if (fresh.length > 0) return fresh
  return readStaleOfficialFromStorage()
}

async function fetchOfficialFromSupabase(): Promise<UJEvent[]> {
  const { data, error } = await supabase
    .from('official_events')
    .select(
      'id, external_id, title, date, category, location, description, faculty, source_name, event_url, image_url',
    )
    .order('date', { ascending: true })

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[EventIngestor] official_events select error:', error.message)
    }
    throw new Error(error.message)
  }

  const rows = (data ?? []) as OfficialEventRow[]
  return rows
    .map((row) => rowToUjEvent(row))
    .filter((e): e is UJEvent => e !== null)
}

async function runSyncExternal(force: boolean): Promise<IngestSyncResult> {
  if (!force) {
    const fresh = readOfficialEventsFromCache()
    if (fresh.length > 0) {
      return { events: dedupeByExternalId(fresh), fromStaticFallback: false }
    }
  }

  try {
    const events = await fetchOfficialFromSupabase()
    if (events.length > 0) {
      const deduped = dedupeByExternalId(events)
      writeOfficialCache(deduped)
      return { events: deduped, fromStaticFallback: false }
    }
  } catch {
    /* spróbujemy stale cache poniżej */
  }

  const stale = readStaleOfficialFromStorage()
  if (stale.length > 0) {
    return { events: dedupeByExternalId(stale), fromStaticFallback: false }
  }

  return { events: getStaticFallbackOfficialEvents(), fromStaticFallback: true }
}

export async function syncExternalEvents(force = false): Promise<IngestSyncResult> {
  if (typeof window === 'undefined') {
    return { events: [], fromStaticFallback: false }
  }
  if (!force && syncPromise) return syncPromise

  syncPromise = (async (): Promise<IngestSyncResult> => {
    try {
      return await runSyncExternal(force)
    } catch {
      return { events: getStaticFallbackOfficialEvents(), fromStaticFallback: true }
    } finally {
      syncPromise = null
    }
  })()

  return syncPromise
}
