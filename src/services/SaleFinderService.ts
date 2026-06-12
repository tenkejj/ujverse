/**
 * SaleFinderService — wyszukiwarka sal i budynków UJ.
 *
 * Wszystkie zapytania idą do `public.uj_buildings` / `public.uj_rooms` przez
 * supabase-js (RLS public read). Tabele są małe (~20 budynków, ~50 sal), więc
 * lista budynków jest cache'owana w pamięci modułu na pierwsze wejście —
 * fuzzy search jest robiony lokalnie po kompilacji wyników z Supabase.
 *
 * Helpery (haversine, googleMapsDirectionsUrl) są pure functions — używane
 * też przez `SaleFinderView` do wyliczania dystansu do user-location.
 */

import { supabase } from '../supabaseClient'

export type Building = {
  id: string
  name: string
  short_name: string | null
  address: string
  lat: number
  lng: number
  photo_url: string | null
  description: string | null
  faculty_slug: string | null
  campus: string | null
  search_aliases: string[]
}

export type Room = {
  id: string
  building_id: string
  code: string
  display_name: string | null
  floor: number | null
  capacity: number | null
  photo_url: string | null
  notes: string | null
}

export type RoomWithBuilding = Room & {
  building: Building
}

const BUILDING_COLS =
  'id, name, short_name, address, lat, lng, photo_url, description, faculty_slug, campus, search_aliases'

const ROOM_COLS =
  'id, building_id, code, display_name, floor, capacity, photo_url, notes'

type BuildingRowDb = {
  id: string
  name: string
  short_name: string | null
  address: string
  lat: number | string
  lng: number | string
  photo_url: string | null
  description: string | null
  faculty_slug: string | null
  campus: string | null
  search_aliases: string[] | null
}

type RoomRowDb = {
  id: string
  building_id: string
  code: string
  display_name: string | null
  floor: number | null
  capacity: number | null
  photo_url: string | null
  notes: string | null
}

function numericFromDb(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return value
}

function normalizeBuilding(row: BuildingRowDb): Building {
  const lat = numericFromDb(row.lat)
  const lng = numericFromDb(row.lng)
  if (lat === null || lng === null) {
    // numeric NOT NULL na poziomie schema, ale gdy migracja jeszcze nie
    // poszła na bazę, PostgREST może zwrócić niespójne dane. Logujemy
    // ostrzeżenie zamiast cichego NaN który by potem wybuchł w Leaflet.
    if (typeof console !== 'undefined') {
      console.warn(
        `[SaleFinder] Budynek "${row.id}" ma brakujące/nieprawidłowe lat/lng — ` +
          'pomijam. Sprawdź czy migracja 20260616100000_uj_buildings_rooms.sql ' +
          'jest zaaplikowana.',
      )
    }
  }
  return {
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    address: row.address,
    // 0,0 fallback — Leaflet przyjmie, ale w UI sprawdzamy `Number.isFinite`
    // i renderujemy error card zamiast mapy gdy współrzędne są wyzerowane.
    lat: lat ?? 0,
    lng: lng ?? 0,
    photo_url: row.photo_url,
    description: row.description,
    faculty_slug: row.faculty_slug,
    campus: row.campus,
    search_aliases: row.search_aliases ?? [],
  }
}

function normalizeRoom(row: RoomRowDb): Room {
  return {
    id: row.id,
    building_id: row.building_id,
    code: row.code,
    display_name: row.display_name,
    floor: row.floor,
    capacity: row.capacity,
    photo_url: row.photo_url,
    notes: row.notes,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Cache budynków — tabela jest mała (~20 wierszy) i prawie statyczna.
// Pierwszy fetch trafia do Supabase, kolejne idą z pamięci do następnego
// reload'u strony. Cache jest invalidowany ręcznie przez `clearCache()`
// (na razie nie używane — gdyby admin dodał budynek live, user zobaczy go
// po refreshu).
// ─────────────────────────────────────────────────────────────────────────

let buildingsCache: Building[] | null = null
let buildingsPromise: Promise<Building[]> | null = null

async function loadAllBuildings(): Promise<Building[]> {
  if (buildingsCache) return buildingsCache
  if (buildingsPromise) return buildingsPromise

  buildingsPromise = (async () => {
    const { data, error } = await supabase
      .from('uj_buildings')
      .select(BUILDING_COLS)
      .order('name', { ascending: true })

    if (error) {
      buildingsPromise = null
      throw new Error(error.message)
    }

    const normalized = (data ?? []).map((row) => normalizeBuilding(row as BuildingRowDb))
    buildingsCache = normalized
    return normalized
  })()

  try {
    return await buildingsPromise
  } finally {
    buildingsPromise = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Search — fuzzy match po nazwie / aliasie / adresie / kodzie sali.
// Implementacja oparta o lokalny ranking (małe tabele) zamiast SQL ILIKE,
// bo jeden wyszukiwany termin powinien matchować *zarówno* budynki
// (po nazwie) jak i sale (po kodzie) i dawać jeden mixed result list.
// ─────────────────────────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ł]/g, 'l')
    .replace(/[Ł]/g, 'l')
    .trim()
}

function tokensFor(building: Building): string[] {
  const tokens = [
    building.name,
    building.short_name ?? '',
    building.address,
    ...(building.search_aliases ?? []),
  ]
  return tokens.filter(Boolean).map(normalizeText)
}

function tokensForRoom(room: Room, building: Building): string[] {
  return [
    room.code,
    room.display_name ?? '',
    `${room.code} ${building.name}`,
    `${room.code} ${building.short_name ?? ''}`,
    ...tokensFor(building),
  ]
    .filter(Boolean)
    .map(normalizeText)
}

function scoreMatch(haystacks: string[], needle: string): number {
  // 0 = brak trafienia. Wyższy = lepszy.
  let best = 0
  for (const h of haystacks) {
    if (!h) continue
    if (h === needle) {
      best = Math.max(best, 100)
      continue
    }
    if (h.startsWith(needle)) {
      best = Math.max(best, 70)
      continue
    }
    if (h.includes(needle)) {
      best = Math.max(best, 40)
      continue
    }
  }
  return best
}

export type SearchResult =
  | { kind: 'building'; building: Building; score: number }
  | { kind: 'room'; room: Room; building: Building; score: number }

export async function searchSale(rawQuery: string, limit = 12): Promise<SearchResult[]> {
  const query = normalizeText(rawQuery)
  if (!query) return []

  const buildings = await loadAllBuildings()
  const buildingById = new Map(buildings.map((b) => [b.id, b]))

  const buildingHits: SearchResult[] = []
  for (const b of buildings) {
    const score = scoreMatch(tokensFor(b), query)
    if (score > 0) {
      buildingHits.push({ kind: 'building', building: b, score })
    }
  }

  // Sale: wyciągamy WSZYSTKIE (mała tabela) — robimy server-side ILIKE
  // tylko gdy query jest "kodopodobne" (cyfry / kropki / myślniki). Inaczej
  // zostajemy lokalni żeby nie obciążać Supabase request-per-keystroke.
  const looksLikeRoomCode = /^[0-9a-zA-Z._\-/]{1,12}$/.test(rawQuery.trim())

  const roomHits: SearchResult[] = []
  if (looksLikeRoomCode) {
    const { data, error } = await supabase
      .from('uj_rooms')
      .select(ROOM_COLS)
      .or(`code.ilike.%${rawQuery.trim()}%,display_name.ilike.%${rawQuery.trim()}%`)
      .limit(40)

    if (!error && data) {
      for (const raw of data) {
        const room = normalizeRoom(raw as RoomRowDb)
        const building = buildingById.get(room.building_id)
        if (!building) continue
        const score = scoreMatch(tokensForRoom(room, building), query)
        if (score > 0) roomHits.push({ kind: 'room', room, building, score })
      }
    }
  }

  // Deduplicate: gdy budynek match'uje też sam, ale jest reprezentowany
  // przez konkretną salę — zachowujemy obie (user może chcieć całego
  // budynku albo konkretnej sali). Ranking decyduje o kolejności.
  const merged = [...buildingHits, ...roomHits]
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Przy remisach: budynki przed salami (wejście do budynku jest
    // bardziej kanoniczne dla "kierunku"), potem alfabetycznie.
    if (a.kind !== b.kind) return a.kind === 'building' ? -1 : 1
    const aLabel = a.kind === 'building' ? a.building.name : a.room.code
    const bLabel = b.kind === 'building' ? b.building.name : b.room.code
    return aLabel.localeCompare(bLabel, 'pl')
  })

  return merged.slice(0, limit)
}

// ─────────────────────────────────────────────────────────────────────────
// Detail loaders
// ─────────────────────────────────────────────────────────────────────────

export async function listBuildings(): Promise<Building[]> {
  return loadAllBuildings()
}

export async function getBuildingById(id: string): Promise<Building | null> {
  const buildings = await loadAllBuildings()
  return buildings.find((b) => b.id === id) ?? null
}

export async function listRoomsForBuilding(buildingId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('uj_rooms')
    .select(ROOM_COLS)
    .eq('building_id', buildingId)
    .order('floor', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => normalizeRoom(row as RoomRowDb))
}

export async function getRoomById(roomId: string): Promise<RoomWithBuilding | null> {
  const { data, error } = await supabase
    .from('uj_rooms')
    .select(`${ROOM_COLS}, building:uj_buildings(${BUILDING_COLS})`)
    .eq('id', roomId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  // PostgREST infers FK joins jako tablicę nawet dla single-row FK
  // (`building_id` → `uj_buildings.id`). Cast przez `unknown` jest świadomy —
  // runtime zwraca pojedynczy obiekt bo FK jest typu 1:1.
  type Joined = RoomRowDb & { building: BuildingRowDb | null }
  const row = data as unknown as Joined
  if (!row.building) return null

  return {
    ...normalizeRoom(row),
    building: normalizeBuilding(row.building),
  }
}

export function clearCache(): void {
  buildingsCache = null
  buildingsPromise = null
}

// ─────────────────────────────────────────────────────────────────────────
// Helpery geograficzne
// ─────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_KM * c
}

/** Szybki proxy "ile minut piechotą". Założenie: ~5 km/h chodu pieszego. */
export function walkingMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 5) * 60))
}

export function googleMapsDirectionsUrl(
  destination: { lat: number; lng: number },
  origin?: { lat: number; lng: number } | null,
): string {
  const destStr = `${destination.lat},${destination.lng}`
  const params = new URLSearchParams({
    api: '1',
    destination: destStr,
    travelmode: 'walking',
  })
  if (origin) {
    params.set('origin', `${origin.lat},${origin.lng}`)
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function googleMapsSearchUrl(point: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000 / 10) * 10
    return `${meters} m`
  }
  return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`
}
