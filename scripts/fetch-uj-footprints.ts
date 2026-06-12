/**
 * fetch-uj-footprints.ts
 *
 * Jednorazowy scraper: dla każdego budynku UJ z `uj_buildings` (lat/lng)
 * odpytuje Overpass API o ways/relations z tagiem `building=*` w promieniu
 * ~30 m wokół centroidu i zapisuje footprint jako GeoJSON Feature do
 * `public/uj-footprints/{building_id}.geojson`.
 *
 * Plik per budynek (a nie jeden FeatureCollection) — bo Vite serwuje static
 * assets per-path, a my chcemy lazy-loadować footprint tylko dla wybranego
 * budynku w `Campus3DService`. Plus łatwiejszy diff w PR jak ktoś chce
 * ręcznie zedytować jeden footprint (np. źle wykryty budynek w OSM).
 *
 * Strategia wyboru kandydata gdy Overpass zwróci kilka:
 *   1. najmniejsza odległość Haversine między centroidem kandydata
 *      a `building.lat/lng` z `uj_buildings`,
 *   2. tie-break po obecności tagu `building:levels` lub `height` (lepsze
 *      dane = preferuj),
 *   3. pomijamy way'e bez closed polygon (< 4 nodes lub pierwszy != ostatni).
 *
 * GeoJSON output zawiera w `properties`:
 *   - `osm_id`, `osm_type` ('way' | 'relation')
 *   - `levels`: number | null  (z OSM `building:levels`)
 *   - `height_m`: number | null (z `height` parsed lub `levels * 3.5`)
 *   - `name`: OSM `name` tag (do debug)
 *   - `building_id`: UJ slug
 *
 * Użycie:
 *   npm run footprints:fetch                       # wszystkie
 *   npm run footprints:fetch -- --only=collegium-novum
 *
 * UWAGA: Skrypt jest read-only z punktu widzenia DB — nie pisze do Supabase
 * (footprints są statycznymi assetami w repo, nie schema'ą).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// Lista mirroriów Overpass — gdy main rate-limituje, próbujemy alternatywne.
// `kumi.systems` to community-maintained mirror z luźniejszym rate-limitem,
// `overpass.private.coffee` to drugi public mirror.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
// Promienie searchowane progresywnie — pierwsza próba 35m (tight match
// dla budynków z dokładnym lat/lng), eskalacja przy braku trafień.
const SEARCH_RADII_M = [35, 60, 120]
const REQUEST_DELAY_MS = 2500 // konserwatywnie, żeby unikać 429
const MAX_RETRIES = 4
const DEFAULT_STOREY_HEIGHT_M = 3.5

const ROOT_DIR = path.resolve(process.cwd())
const OUT_DIR = path.join(ROOT_DIR, 'public', 'uj-footprints')

// ─────────────────────────────────────────────────────────────────────────
// Lista budynków UJ — w sync z seedem z migracji
// 20260616100000_uj_buildings_rooms.sql. Trzymamy hardcoded zamiast czytać
// z Supabase, żeby skrypt nie wymagał `.env` z service role i działał
// w CI / na świeżym checkoutcie.
// ─────────────────────────────────────────────────────────────────────────

type UJBuilding = {
  id: string
  name: string
  lat: number
  lng: number
  /** Ulica do dopasowania w OSM `addr:street`. */
  street: string
  /** Nr domu, dopasowywany w OSM `addr:housenumber`. */
  housenumber: string
  /**
   * Manualny override OSM way ID — gdy znamy konkretny budynek z
   * `discover-uj-osm.ts` i nie chcemy zgadywania po adresie/promieniu.
   * Najbardziej deterministyczny path.
   */
  osmWayId?: number
  /**
   * Manualny override OSM relation ID (multipolygon — np. budynek z
   * dziedzińcem). Niektóre wydziały UJ (WMI, WZiKS) są w OSM jako
   * relacje, nie ways. Alternatywne do `osmWayId`.
   */
  osmRelationId?: number
  /**
   * Manualny override wysokości w metrach — gdy OSM nie ma
   * `height` ani `building:levels`. Wartości oszacowane z Google Street
   * View / wiki UJ / zdjęć budynku.
   */
  manualHeightM?: number
  /** Manualny override liczby pięter naziemnych. */
  manualLevels?: number
  /**
   * Gdy budynek nie istnieje jako footprint w OSM (np. WGG Gronostajowa
   * 3a — tylko address node), generujemy default rectangle. Wymiary
   * w metrach.
   */
  fallbackRectangle?: { widthM: number; depthM: number }
}

const UJ_BUILDINGS: UJBuilding[] = [
  // ── Śródmieście (wokół Rynku Gł., Plant) ─────────────────────────────
  {
    id: 'collegium-novum', name: 'Collegium Novum',
    lat: 50.061190, lng: 19.933530,
    street: 'Gołębia', housenumber: '24',
    // OSM oznacza ten way jako "Collegium Minus" (przestarzała nazwa)
    // ale to FAKTYCZNE Collegium Novum (główny budynek rektoratu).
    osmWayId: 39357544,
    manualLevels: 4, manualHeightM: 14,
  },
  {
    id: 'collegium-maius', name: 'Collegium Maius',
    lat: 50.061563, lng: 19.933409,
    street: 'Jagiellońska', housenumber: '15',
    // Nominatim: way 781854753 "Collegium Maius" amenity=university
    osmWayId: 781854753,
    manualLevels: 3, manualHeightM: 13,
  },
  {
    id: 'auditorium-maximum', name: 'Auditorium Maximum',
    lat: 50.063078, lng: 19.925139,
    street: 'Krupnicza', housenumber: '33',
    osmWayId: 1288895978,
    manualLevels: 4, manualHeightM: 16,
  },

  // ── Kampus 600-lecia ─────────────────────────────────────────────────
  // UWAGA: lat/lng w seedzie z migracji 20260616100000 były bardzo
  // nieprecyzyjne (wszystkie wskazywały na jeden mega-kompleks
  // 1150231328). Tu poprawione na rzeczywiste centroidy z Nominatim.
  {
    id: 'lojasiewicza-6', name: 'WMI',
    lat: 50.030599, lng: 19.907399,
    street: 'Łojasiewicza', housenumber: '6',
    // Nominatim: relation 3138934 (multipolygon) — Wydział Matematyki
    // i Informatyki na Łojasiewicza 6.
    osmRelationId: 3138934,
    manualLevels: 4, manualHeightM: 16,
  },
  {
    id: 'lojasiewicza-11', name: 'WFAIS',
    lat: 50.029072, lng: 19.904907,
    street: 'Łojasiewicza', housenumber: '11',
    // Nominatim: way 781195175 amenity=university na Łojasiewicza 11.
    osmWayId: 781195175,
    manualLevels: 4, manualHeightM: 16,
  },
  {
    id: 'gronostajowa-9', name: 'WB',
    lat: 50.027385, lng: 19.900719,
    street: 'Gronostajowa', housenumber: '9',
    // Nominatim: way 233371617 building=university (operator UJ).
    osmWayId: 233371617,
    manualLevels: 3, manualHeightM: 12,
  },
  {
    id: 'gronostajowa-2', name: 'WCh',
    lat: 50.029092, lng: 19.904106,
    street: 'Gronostajowa', housenumber: '2',
    osmWayId: 202979312,
    manualLevels: 4, manualHeightM: 14,
  },
  {
    id: 'gronostajowa-3a', name: 'WGG',
    lat: 50.027436, lng: 19.903726,
    street: 'Gronostajowa', housenumber: '3a',
    // OSM ma multipolygon relację 3138933 dla budynku WGG (znalezione
    // przez radius w pierwszym runie, 19.8m od adresu). Pinujemy
    // explicitly żeby było deterministyczne.
    osmRelationId: 3138933,
    // Default rectangle gdyby relacja kiedyś zniknęła z OSM.
    fallbackRectangle: { widthM: 60, depthM: 25 },
    manualLevels: 3, manualHeightM: 12,
  },
  {
    id: 'lojasiewicza-4', name: 'WZiKS',
    lat: 50.030279, lng: 19.908995,
    street: 'Łojasiewicza', housenumber: '4',
    // Nominatim: relation 9786312 building=university.
    osmRelationId: 9786312,
    manualLevels: 4, manualHeightM: 14,
  },

  // ── Filologia / Filozofia (al. Mickiewicza okolice) ──────────────────
  {
    id: 'mickiewicza-9-11', name: 'WFil',
    lat: 50.062756, lng: 19.924494,
    street: 'Mickiewicza', housenumber: '9',
    // way 39393936 "Collegium Paderevianum" lvl=6 (główny budynek WFil)
    osmWayId: 39393936,
    manualLevels: 6, manualHeightM: 22,
  },
  {
    id: 'ingardena-6', name: 'WFz',
    lat: 50.061626, lng: 19.920077,
    street: 'Ingardena', housenumber: '6',
    // Way 231815922 znaleziony przez address query (21.5m od centroidu
    // amenity node "Instytut Psychologii UJ" 9152279656). Pinujemy.
    osmWayId: 231815922,
    manualLevels: 4, manualHeightM: 14,
  },

  // ── Gołębia (centrum starówki) ───────────────────────────────────────
  // WH i WPol są fizycznie w jednym pasie kamienic — OSM ma jeden way
  // (304504505) który obejmuje obie nieruchomości. Dla naszych celów
  // wizualnych to akceptowalne — w widoku eksplodowanym i tak rozróżniamy
  // budynki po `building_id`, a footprint jest poglądowy.
  {
    id: 'golebia-13', name: 'WH',
    lat: 50.061365, lng: 19.932980,
    street: 'Gołębia', housenumber: '13',
    osmWayId: 304504505,
    manualLevels: 4, manualHeightM: 14,
  },
  {
    id: 'golebia-16', name: 'WPol',
    lat: 50.060735, lng: 19.934369,
    street: 'Gołębia', housenumber: '16',
    osmWayId: 304504505,
    manualLevels: 4, manualHeightM: 14,
  },

  {
    id: 'bracka-12', name: 'WPiA',
    lat: 50.059714, lng: 19.936322,
    street: 'Bracka', housenumber: '12',
    // way 858335310 wybrany przez radius w poprzednim runie — to
    // kamienica przy Brackiej 12.
    osmWayId: 858335310,
    manualLevels: 3, manualHeightM: 12,
  },
  {
    id: 'reymonta-4', name: 'WSMiP',
    lat: 50.063577, lng: 19.920147,
    street: 'Reymonta', housenumber: '4',
    osmWayId: 231815748,
    manualLevels: 2, manualHeightM: 8,
  },
  {
    id: 'mickiewicza-22-bj', name: 'Biblioteka Jagiellońska',
    lat: 50.061438, lng: 19.922505,
    street: 'Mickiewicza', housenumber: '22',
    // Nominatim: way 256406931 amenity=library "Biblioteka Jagiellońska"
    osmWayId: 256406931,
    manualLevels: 4, manualHeightM: 16,
  },
  {
    id: 'piastowska-26', name: 'SWFiS',
    lat: 50.066168, lng: 19.901782,
    street: 'Piastowska', housenumber: '26',
    // Nominatim: way 230301701 amenity=university "SWFiS UJ"
    osmWayId: 230301701,
    manualLevels: 3, manualHeightM: 12,
  },
  {
    id: 'sw-anny-12', name: 'CM UJ Św. Anny',
    lat: 50.061600, lng: 19.936700,
    street: 'św. Anny', housenumber: '12',
    // way 25122842 — z radius pick, bliżej brak weryfikacji ale akceptujemy
    osmWayId: 25122842,
    manualLevels: 3, manualHeightM: 12,
  },
]

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const EARTH_R = 6_371_000 // metres

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(h))
}

function centroidOfRing(ring: Array<[number, number]>): { lat: number; lng: number } {
  // Prosty arithmetic mean — wystarczający dla rankowania (nie do GIS).
  let lat = 0
  let lng = 0
  // Pomijamy ostatni point bo to duplikat pierwszego (closed ring).
  const n = ring.length - 1
  for (let i = 0; i < n; i++) {
    lng += ring[i][0]
    lat += ring[i][1]
  }
  return { lat: lat / n, lng: lng / n }
}

function parseHeight(raw: string | undefined): number | null {
  if (!raw) return null
  // OSM dopuszcza `height=12`, `height=12 m`, `height=12.5`, ` 12 ` itp.
  const trimmed = raw.trim().replace(/[, ]+m$/i, '').replace(',', '.')
  const num = Number.parseFloat(trimmed)
  return Number.isFinite(num) && num > 0 ? num : null
}

function parseLevels(raw: string | undefined): number | null {
  if (!raw) return null
  const num = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(num) && num > 0 ? num : null
}

// ─────────────────────────────────────────────────────────────────────────
// Overpass query
// ─────────────────────────────────────────────────────────────────────────

type OverpassNode = { type: 'node'; id: number; lat: number; lon: number }
type OverpassWay = {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}
type OverpassRelation = {
  type: 'relation'
  id: number
  members: Array<{ type: string; ref: number; role: string }>
  tags?: Record<string, string>
}
type OverpassElement = OverpassNode | OverpassWay | OverpassRelation

type OverpassResponse = {
  version: number
  generator: string
  elements: OverpassElement[]
}

/**
 * Query po promieniu (fallback gdy nie znamy ani way ID, ani adresu).
 * Najmniej deterministyczny — może złapać sąsiedni budynek.
 */
function buildRadiusQuery(lat: number, lng: number, radius: number): string {
  return (
    `[out:json][timeout:30];` +
    `(way["building"](around:${radius},${lat},${lng});` +
    `relation["building"](around:${radius},${lat},${lng}););` +
    `out body;>;out skel qt;`
  )
}

/**
 * Query po explicit OSM way ID — najbardziej deterministyczny path.
 * Używane gdy `osmWayId` jest podane w `UJ_BUILDINGS`.
 */
function buildIdQuery(wayId: number): string {
  return (
    `[out:json][timeout:30];` +
    `way(${wayId});` +
    `out body;>;out skel qt;`
  )
}

/**
 * Query po OSM relation ID (multipolygon — np. budynek z dziedzińcem).
 * Pobieramy relację + wszystkie jej way members + wszystkie nodes
 * (`>>;` rekursywnie schodzi w dół).
 */
function buildRelationQuery(relationId: number): string {
  return (
    `[out:json][timeout:30];` +
    `relation(${relationId});` +
    `out body;>>;out skel qt;`
  )
}

/**
 * Query po adresie — `addr:street` + `addr:housenumber` w okolicy
 * podanego punktu (radius 200m — żeby wyłapać wszystkie sensowne
 * dopasowania ale nie przesadzić z hałasem).
 *
 * OSM ulice mają zwykle pełną nazwę (`ulica Łojasiewicza`,
 * `aleja Mickiewicza`) — robimy case-insensitive regex match który
 * akceptuje też skrót.
 */
function buildAddressQuery(
  street: string,
  housenumber: string,
  lat: number,
  lng: number,
  radius = 200,
): string {
  // Escape regex special chars in street name (np. `św.` ma kropkę).
  const safeStreet = street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    `[out:json][timeout:30];` +
    `(` +
      `way["building"]["addr:street"~"${safeStreet}",i]` +
        `["addr:housenumber"="${housenumber}"](around:${radius},${lat},${lng});` +
      `relation["building"]["addr:street"~"${safeStreet}",i]` +
        `["addr:housenumber"="${housenumber}"](around:${radius},${lat},${lng});` +
    `);` +
    `out body;>;out skel qt;`
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchOverpassOnce(
  endpoint: string,
  query: string,
): Promise<OverpassResponse> {
  const body = `data=${encodeURIComponent(query)}`
  const res = await fetch(endpoint, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      // Overpass wymaga User-Agent dla traffic shaping; default node/undici
      // user agent jest filtrowany i zwraca 406.
      'User-Agent': 'ujverse-footprint-scraper/1.0 (https://ujverse.pl)',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}`)
    ;(err as Error & { status?: number; body?: string }).status = res.status
    ;(err as Error & { status?: number; body?: string }).body = text.slice(0, 200)
    throw err
  }
  return (await res.json()) as OverpassResponse
}

/**
 * Fetch z retry: dla 429/504 czekamy z exponential backoff i przerzucamy
 * na kolejny mirror. Pozostałe błędy (np. 400) lecą bez retry.
 */
async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length]
    try {
      return await fetchOverpassOnce(endpoint, query)
    } catch (err) {
      lastErr = err
      const status = (err as Error & { status?: number }).status
      const retryable = status === 429 || status === 503 || status === 504 || !status
      if (!retryable) throw err
      // Exponential backoff: 3s, 6s, 12s, 24s
      const backoff = 3000 * 2 ** attempt
      console.warn(
        `  retry ${attempt + 1}/${MAX_RETRIES} (status=${status ?? 'network'}, endpoint=${
          new URL(endpoint).host
        }) after ${backoff}ms`,
      )
      await sleep(backoff)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Overpass retries exhausted')
}

// ─────────────────────────────────────────────────────────────────────────
// GeoJSON build
// ─────────────────────────────────────────────────────────────────────────

type Coord = [number, number] // [lng, lat] (GeoJSON convention)
type LinearRing = Coord[]

type FootprintFeature = {
  type: 'Feature'
  geometry: {
    type: 'Polygon'
    coordinates: LinearRing[] // [outer, ...holes]
  }
  properties: {
    building_id: string
    osm_id: number
    osm_type: 'way' | 'relation'
    name: string | null
    levels: number | null
    height_m: number | null
    source: 'overpass'
    /** Strategia która znalazła ten footprint — diagnostyczne. */
    match_strategy: 'osm_id' | 'address' | 'radius'
    generated_at: string
  }
}

function nodesMap(res: OverpassResponse): Map<number, OverpassNode> {
  const map = new Map<number, OverpassNode>()
  for (const el of res.elements) {
    if (el.type === 'node') map.set(el.id, el)
  }
  return map
}

function wayToRing(
  way: OverpassWay,
  nodes: Map<number, OverpassNode>,
): LinearRing | null {
  const coords: Coord[] = []
  for (const nodeId of way.nodes) {
    const node = nodes.get(nodeId)
    if (!node) return null
    coords.push([node.lon, node.lat])
  }
  if (coords.length < 4) return null
  // Force-close ring jeśli OSM zwróciło bez duplikatu na końcu.
  const [first] = coords
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return coords
}

type Candidate = {
  coordinates: LinearRing[]
  element: OverpassWay | OverpassRelation
  distance: number
  hasMetadata: boolean
}

function waysMap(res: OverpassResponse): Map<number, OverpassWay> {
  const map = new Map<number, OverpassWay>()
  for (const el of res.elements) {
    if (el.type === 'way') map.set(el.id, el)
  }
  return map
}

/**
 * Wybiera najlepszego kandydata z odpowiedzi Overpass dla danego punktu UJ.
 * Returns null gdy nic w promieniu nie pasuje (zwykle bug w OSM lub
 * zła lokalizacja w `uj_buildings`).
 *
 * Akceptuje też relacje (multipoligon) — np. budynki z dziedzińcem.
 */
function pickBestCandidate(
  res: OverpassResponse,
  target: { lat: number; lng: number },
): Candidate | null {
  const nodes = nodesMap(res)
  const ways = waysMap(res)
  const candidates: Candidate[] = []

  for (const el of res.elements) {
    if (el.type === 'way') {
      if (!el.tags?.['building']) continue
      const ring = wayToRing(el, nodes)
      if (!ring) continue
      const center = centroidOfRing(ring)
      const distance = haversineM(target, center)
      const hasMetadata = Boolean(
        el.tags['building:levels'] || el.tags['height'] || el.tags['name'],
      )
      candidates.push({ coordinates: [ring], element: el, distance, hasMetadata })
    } else if (el.type === 'relation') {
      if (!el.tags?.['building'] && !el.tags?.['type']) continue
      const rings = relationToPolygon(el, ways, nodes)
      if (!rings || rings.length === 0) continue
      const center = centroidOfRing(rings[0])
      const distance = haversineM(target, center)
      const hasMetadata = Boolean(
        el.tags['building:levels'] || el.tags['height'] || el.tags['name'],
      )
      candidates.push({ coordinates: rings, element: el, distance, hasMetadata })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance
    if (a.hasMetadata !== b.hasMetadata) return a.hasMetadata ? -1 : 1
    return 0
  })

  return candidates[0]
}

function buildFeature(
  building: UJBuilding,
  pick: {
    coordinates: LinearRing[]
    element: OverpassWay | OverpassRelation
  },
  matchStrategy: 'osm_id' | 'address' | 'radius' | 'synthetic',
): FootprintFeature {
  const tags = pick.element.tags ?? {}
  const osmLevels = parseLevels(tags['building:levels'])
  const osmHeightExplicit = parseHeight(tags['height'])
  const osmHeightFromLevels = osmLevels !== null ? osmLevels * DEFAULT_STOREY_HEIGHT_M : null
  const osmHeight = osmHeightExplicit ?? osmHeightFromLevels

  // Manual overrides (z UJ_BUILDINGS) BIJĄ OSM gdy są podane — wiedza
  // local > zdalna baza danych. Bez override'u używamy OSM, a gdy nawet
  // OSM milczy — wartość null (UI fallback'uje na default 12m).
  const levels = building.manualLevels ?? osmLevels
  const height = building.manualHeightM ?? osmHeight

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: pick.coordinates,
    },
    properties: {
      building_id: building.id,
      osm_id: pick.element.id,
      osm_type: pick.element.type as 'way' | 'relation',
      name: tags['name'] ?? null,
      levels,
      height_m: height,
      source: 'overpass',
      match_strategy: matchStrategy,
      generated_at: new Date().toISOString(),
    },
  }
}

/**
 * Buduje syntetyczny polygon (prostokąt) wokół podanego punktu —
 * używane jako ostateczny fallback gdy budynek nie ma footprintu w
 * OSM. Wymiary w metrach (przybliżenie equirectangular — wystarcza dla
 * budynków o rozmiarze < 200m w Krakowie).
 */
function buildSyntheticRectangle(
  building: UJBuilding,
): FootprintFeature {
  const { widthM, depthM } = building.fallbackRectangle!
  // Konwersja metrów → stopnie geograficzne:
  // 1 stopień szerokości ≈ 111 320 m
  // 1 stopień długości ≈ 111 320 · cos(lat) m
  const latPerM = 1 / 111_320
  const lngPerM = 1 / (111_320 * Math.cos((building.lat * Math.PI) / 180))
  const halfW = (widthM / 2) * lngPerM
  const halfD = (depthM / 2) * latPerM
  const ring: LinearRing = [
    [building.lng - halfW, building.lat - halfD],
    [building.lng + halfW, building.lat - halfD],
    [building.lng + halfW, building.lat + halfD],
    [building.lng - halfW, building.lat + halfD],
    [building.lng - halfW, building.lat - halfD],
  ]
  const levels = building.manualLevels ?? 3
  const height = building.manualHeightM ?? levels * DEFAULT_STOREY_HEIGHT_M
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
    properties: {
      building_id: building.id,
      osm_id: 0,
      osm_type: 'way',
      name: building.name,
      levels,
      height_m: height,
      source: 'overpass',
      match_strategy: 'synthetic',
      generated_at: new Date().toISOString(),
    },
  }
}

/**
 * Rekonstruuje polygon z OSM multipolygon relation. Łączy way members
 * z rolą `outer` w jeden ring (gdy są pofragmentowane) i opcjonalnie
 * dodaje `inner` ringi jako dziury.
 *
 * Strategia łączenia: zachłannie szukamy way który zaczyna się/kończy
 * w punkcie końcowym aktualnego stringu i sklejamy go. Dla naszych
 * budynków UJ wystarcza — relacje są zwykle dobrze uformowane.
 */
function relationToPolygon(
  relation: OverpassRelation,
  ways: Map<number, OverpassWay>,
  nodes: Map<number, OverpassNode>,
): LinearRing[] | null {
  const outerWays: OverpassWay[] = []
  const innerWays: OverpassWay[] = []
  for (const m of relation.members) {
    if (m.type !== 'way') continue
    const w = ways.get(m.ref)
    if (!w) continue
    if (m.role === 'inner') innerWays.push(w)
    else outerWays.push(w) // 'outer' lub bez roli traktujemy jako outer
  }
  if (outerWays.length === 0) return null

  const stitchRings = (parts: OverpassWay[]): LinearRing[] => {
    // Konwertujemy każdy way na listę coords; potem sklejamy pasujące końce.
    const segments: Coord[][] = []
    for (const w of parts) {
      const seg: Coord[] = []
      for (const id of w.nodes) {
        const n = nodes.get(id)
        if (!n) return [] // brakuje nodów — nie da się zbudować
        seg.push([n.lon, n.lat])
      }
      if (seg.length >= 2) segments.push(seg)
    }
    const rings: LinearRing[] = []
    while (segments.length > 0) {
      let ring = segments.shift()!
      let changed = true
      while (changed && segments.length > 0) {
        changed = false
        const last = ring[ring.length - 1]
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          const segFirst = seg[0]
          const segLast = seg[seg.length - 1]
          if (segFirst[0] === last[0] && segFirst[1] === last[1]) {
            ring = ring.concat(seg.slice(1))
            segments.splice(i, 1)
            changed = true
            break
          }
          if (segLast[0] === last[0] && segLast[1] === last[1]) {
            ring = ring.concat(seg.slice(0, -1).reverse())
            segments.splice(i, 1)
            changed = true
            break
          }
        }
      }
      if (ring.length >= 4) {
        const first = ring[0]
        const last = ring[ring.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]])
        }
        rings.push(ring)
      }
    }
    return rings
  }

  const outerRings = stitchRings(outerWays)
  if (outerRings.length === 0) return null

  // Bierzemy największy outer (po obwodzie) jako main ring; resztę
  // ignorujemy. To upraszcza ale dla budynków UJ działa.
  outerRings.sort((a, b) => ringPerimeter(b) - ringPerimeter(a))
  const main = outerRings[0]

  const innerRings = stitchRings(innerWays)
  return [main, ...innerRings]
}

function ringPerimeter(ring: LinearRing): number {
  let p = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    p += Math.hypot(a[0] - b[0], a[1] - b[1])
  }
  return p
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function pathExists(p: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises')
    await access(p)
    return true
  } catch {
    return false
  }
}

function parseArgs(): { only: string | null; force: boolean } {
  let only: string | null = null
  let force = false
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length).trim()
    } else if (arg === '--force') {
      force = true
    }
  }
  return { only, force }
}

/**
 * Buduje "pick" z konkretnego way w Overpass response. Używane przez
 * strategie OSM_ID gdzie kandydat jest jeden (z definicji).
 */
function singleWayPick(res: OverpassResponse): Candidate | null {
  const nodes = nodesMap(res)
  for (const el of res.elements) {
    if (el.type !== 'way') continue
    const ring = wayToRing(el, nodes)
    if (!ring) continue
    return {
      coordinates: [ring],
      element: el,
      distance: 0,
      hasMetadata: Boolean(
        el.tags?.['building:levels'] || el.tags?.['height'] || el.tags?.['name'],
      ),
    }
  }
  return null
}

/**
 * Buduje "pick" z konkretnej OSM relation (multipolygon). Łączy way
 * members w outer/inner ringi.
 */
function singleRelationPick(res: OverpassResponse): Candidate | null {
  const nodes = nodesMap(res)
  const ways = waysMap(res)
  for (const el of res.elements) {
    if (el.type !== 'relation') continue
    const rings = relationToPolygon(el, ways, nodes)
    if (!rings || rings.length === 0) continue
    return {
      coordinates: rings,
      element: el,
      distance: 0,
      hasMetadata: Boolean(
        el.tags?.['building:levels'] || el.tags?.['height'] || el.tags?.['name'],
      ),
    }
  }
  return null
}

type FetchResult = {
  feature: FootprintFeature
  pick: Candidate
  strategy: 'osm_id' | 'address' | 'radius' | 'synthetic'
}

async function fetchOneBuilding(b: UJBuilding): Promise<FetchResult | null> {
  // ── 1a. OSM relation ID override (multipolygon, np. WMI/WZiKS) ──────
  if (b.osmRelationId) {
    try {
      const res = await fetchOverpass(buildRelationQuery(b.osmRelationId))
      const pick = singleRelationPick(res)
      if (pick) {
        return {
          feature: buildFeature(b, pick, 'osm_id'),
          pick,
          strategy: 'osm_id',
        }
      }
      console.warn(`  relation ${b.osmRelationId} nie zwrócił geometrii, fallback dalej.`)
    } catch (err) {
      console.warn(`  relation query failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  // ── 1b. OSM way ID override (single polygon) ────────────────────────
  if (b.osmWayId) {
    try {
      const res = await fetchOverpass(buildIdQuery(b.osmWayId))
      const pick = singleWayPick(res)
      if (pick) {
        return {
          feature: buildFeature(b, pick, 'osm_id'),
          pick,
          strategy: 'osm_id',
        }
      }
      console.warn(`  osm_id ${b.osmWayId} nie zwrócił geometrii, fallback do address.`)
    } catch (err) {
      console.warn(`  osm_id query failed: ${(err as Error).message}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  // ── 2. Adres (street + housenumber) — semi-deterministyczne ─────────
  try {
    const res = await fetchOverpass(
      buildAddressQuery(b.street, b.housenumber, b.lat, b.lng),
    )
    const pick = pickBestCandidate(res, { lat: b.lat, lng: b.lng })
    if (pick) {
      return {
        feature: buildFeature(b, pick, 'address'),
        pick,
        strategy: 'address',
      }
    }
  } catch (err) {
    console.warn(`  address query failed: ${(err as Error).message}`)
  }
  await sleep(REQUEST_DELAY_MS)

  // ── 3. Promień (fallback — może złapać sąsiada) ─────────────────────
  for (const radius of SEARCH_RADII_M) {
    const res = await fetchOverpass(buildRadiusQuery(b.lat, b.lng, radius))
    const pick = pickBestCandidate(res, { lat: b.lat, lng: b.lng })
    if (pick) {
      return {
        feature: buildFeature(b, pick, 'radius'),
        pick,
        strategy: 'radius',
      }
    }
    await sleep(REQUEST_DELAY_MS)
  }

  // ── 4. Syntetyczny prostokąt — gdy budynek nie istnieje w OSM ───────
  if (b.fallbackRectangle) {
    const feature = buildSyntheticRectangle(b)
    const pick: Candidate = {
      coordinates: feature.geometry.coordinates,
      element: { type: 'way', id: 0, nodes: [], tags: { name: b.name } } as OverpassWay,
      distance: 0,
      hasMetadata: false,
    }
    return { feature, pick, strategy: 'synthetic' }
  }

  return null
}

async function main() {
  const { only, force } = parseArgs()
  await mkdir(OUT_DIR, { recursive: true })

  const targets = only
    ? UJ_BUILDINGS.filter((b) => b.id === only)
    : UJ_BUILDINGS

  if (only && targets.length === 0) {
    console.error(`Brak budynku "${only}" w UJ_BUILDINGS. Sprawdź slug.`)
    process.exit(1)
  }

  let ok = 0
  let cached = 0
  let skipped = 0

  for (let i = 0; i < targets.length; i++) {
    const b = targets[i]
    const label = `[${i + 1}/${targets.length}] ${b.id}`
    const outPath = path.join(OUT_DIR, `${b.id}.geojson`)

    if (!force && (await pathExists(outPath))) {
      console.log(`${label} — cached (pomijam, użyj --force żeby odświeżyć)`)
      cached++
      continue
    }

    try {
      const result = await fetchOneBuilding(b)
      if (!result) {
        console.warn(
          `${label} — żadna strategia (osm_id/address/radius) nie zwróciła footprintu.`,
        )
        skipped++
        continue
      }
      await writeFile(outPath, JSON.stringify(result.feature, null, 2) + '\n', 'utf-8')
      const el = result.pick.element
      const idLabel = el.id ? `${el.type}=${el.id}` : 'synth'
      console.log(
        `${label} — OK [${result.strategy}] ${idLabel}, ` +
          `${result.pick.distance.toFixed(1)}m, ` +
          `lvl=${result.feature.properties.levels ?? '—'}, ` +
          `h=${result.feature.properties.height_m?.toFixed(1) ?? '—'}m`,
      )
      ok++
    } catch (err) {
      console.error(`${label} — FAIL:`, (err as Error).message)
      skipped++
    }

    if (i < targets.length - 1) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log(`\nGotowe: ${ok} OK, ${cached} cached, ${skipped} skipped. Output: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
