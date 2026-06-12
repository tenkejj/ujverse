/**
 * Campus3DService — ładowanie footprintów UJ z `public/uj-footprints/*.geojson`
 * i helpery do generowania layoutu boxów w widoku exploded.
 *
 * Footprints są statyczne (commit'owane do repo) — `fetch('/uj-footprints/{id}.geojson')`
 * trafia do Vite static asset serving (dev) lub Vercel CDN (prod). Wartości
 * scrape'owane przez `scripts/fetch-uj-footprints.ts` (jednorazowo).
 *
 * Strategia cache'owania: jeden in-memory `Map<id, Feature>`. Pierwsza
 * pętla po wszystkich UJ buildingach przy mount Campus3DView — od tej pory
 * lookup jest O(1). Brak invalidacji bo footprintów nie zmieniamy w runtime.
 *
 * Public API:
 *   - `loadAllFootprints(ids)` — fetch równolegle dla wszystkich UJ buildings,
 *     zwraca `FeatureCollection` gotowy do MapLibre `addSource`.
 *   - `loadFootprint(id)` — pojedynczy lookup z cache (lub fetch jeśli miss).
 *   - `localProjection(centerLat, centerLng)` — projektor lng/lat → metry
 *     (lokalny tangent plane), używany w exploded view do konwersji
 *     GeoJSON polygon → Three.js Shape.
 */

import type { Building } from './SaleFinderService'

// ─────────────────────────────────────────────────────────────────────────
// Types — minimalna podstawowa typizacja GeoJSON żeby uniknąć zewnętrznej
// zależności na @types/geojson (już mamy je tranzytywnie przez maplibre-gl,
// ale tutaj wystarczy nasz lokalny słownik).
// ─────────────────────────────────────────────────────────────────────────

export type LngLat = [number, number]

export type Polygon = {
  type: 'Polygon'
  coordinates: LngLat[][] // [outer, ...holes]
}

export type FootprintProps = {
  building_id: string
  osm_id: number
  osm_type: 'way' | 'relation'
  name: string | null
  levels: number | null
  height_m: number | null
  source: string
  /**
   * Strategia z którą scraper znalazł ten footprint. Wpływa na confidence:
   *   - `osm_id` — manualnie zweryfikowane OSM way/relation (najwyższe)
   *   - `address` — match po `addr:street`+`addr:housenumber`
   *   - `radius` — heurystyka po najbliższym budynku w promieniu
   *   - `synthetic` — wygenerowany prostokąt (brak danych w OSM)
   */
  match_strategy?: 'osm_id' | 'address' | 'radius' | 'synthetic'
  generated_at: string
  /** Dodawane runtime przez MapLibreCanvas (z DB buildings). */
  short_name?: string | null
  full_name?: string
}

export type FootprintFeature = {
  type: 'Feature'
  id?: string | number
  geometry: Polygon
  properties: FootprintProps
}

export type FootprintFeatureCollection = {
  type: 'FeatureCollection'
  features: FootprintFeature[]
}

// ─────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────

const cache = new Map<string, FootprintFeature | null>()

/**
 * Załaduj footprint dla pojedynczego budynku.
 *
 * Zwraca `null` gdy nie ma pliku w `public/uj-footprints/{id}.geojson` —
 * to legalny stan (np. budynek nie ma OSM footprintu, dodany ręcznie
 * dopiero w manualnej kolejce). UI dla tego budynku pokaże tylko pin
 * + generyczny OSM extrusion w jego miejscu.
 */
export async function loadFootprint(buildingId: string): Promise<FootprintFeature | null> {
  if (cache.has(buildingId)) return cache.get(buildingId) ?? null
  try {
    const res = await fetch(`/uj-footprints/${buildingId}.geojson`)
    if (!res.ok) {
      cache.set(buildingId, null)
      return null
    }
    const raw = (await res.json()) as FootprintFeature
    // Promuj `id` z `building_id` żeby MapLibre `setFeatureState` działało
    // bez dodatkowego mapowania (musi mieć `id` na top-level Feature).
    const feature: FootprintFeature = {
      ...raw,
      id: raw.properties.building_id,
    }
    cache.set(buildingId, feature)
    return feature
  } catch (err) {
    console.warn(`[Campus3D] failed to load footprint for ${buildingId}:`, err)
    cache.set(buildingId, null)
    return null
  }
}

/**
 * Załaduj footprints dla wszystkich budynków UJ równolegle.
 * Zwraca FeatureCollection gotowy do `map.addSource({ type: 'geojson', data })`.
 * Pomija budynki bez footprintu (cicho — nie wszystkie 18 są w OSM).
 */
export async function loadFootprintCollection(
  buildings: Pick<Building, 'id'>[],
): Promise<FootprintFeatureCollection> {
  const results = await Promise.all(buildings.map((b) => loadFootprint(b.id)))
  const features = results.filter((f): f is FootprintFeature => f !== null)
  return { type: 'FeatureCollection', features }
}

export type FootprintMetadata = {
  levels: number | null
  heightM: number | null
  matchStrategy: FootprintProps['match_strategy']
  /** Powierzchnia footprintu w m² (Polygon area, niezbyt precyzyjne). */
  areaM2: number | null
}

/**
 * Pobiera metadata footprintu (bez geometrii) — używane przez UI
 * do pokazania statystyk budynku w detail card. Cache wspólny z
 * `loadFootprint`, więc nie ma duplikatu requestu.
 */
export async function loadFootprintMetadata(
  buildingId: string,
  centerLat: number,
  centerLng: number,
): Promise<FootprintMetadata | null> {
  const fp = await loadFootprint(buildingId)
  if (!fp) return null
  const project = localProjection(centerLat, centerLng)
  const outerMeters = ringToMeters(fp.geometry.coordinates[0], project)
  let area = 0
  for (let i = 0; i < outerMeters.length; i++) {
    const a = outerMeters[i]
    const b = outerMeters[(i + 1) % outerMeters.length]
    area += a.x * b.z - b.x * a.z
  }
  return {
    levels: fp.properties.levels,
    heightM: fp.properties.height_m,
    matchStrategy: fp.properties.match_strategy,
    areaM2: Math.abs(area / 2) || null,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Geo helpers — lokalny projektor lng/lat → metry
// ─────────────────────────────────────────────────────────────────────────

const EARTH_R = 6_371_000

/**
 * Lokalna projekcja `equirectangular` względem `(centerLat, centerLng)`.
 * Dla zakresów <1 km zniekształcenie jest pomijalne (~0.001%). Wystarczy
 * do renderowania budynku w Three.js gdzie liczy się względna geometria,
 * a nie globalna dokładność.
 *
 * Zwraca `(lng, lat) → (x, z)` w metrach gdzie:
 *   - x — east (rosnąca lng)
 *   - z — south (rosnąca lat → MAlejące z, bo Three.js Y-up, prawo-skrętne)
 *
 * Po projekcji centrujemy footprint w (0,0) — exploded view ma origin
 * w środku budynku.
 */
export function localProjection(centerLat: number, centerLng: number) {
  const latRad = (centerLat * Math.PI) / 180
  const mPerDegLng = (Math.PI * EARTH_R * Math.cos(latRad)) / 180
  const mPerDegLat = (Math.PI * EARTH_R) / 180

  return (lng: number, lat: number): { x: number; z: number } => ({
    x: (lng - centerLng) * mPerDegLng,
    // Z rośnie na południe (lat maleje), więc minus.
    z: -(lat - centerLat) * mPerDegLat,
  })
}

/**
 * Konwertuj outer ring GeoJSON Polygon do tablicy `{x, z}` w metrach
 * (gotowy input do `new THREE.Shape(...)`). Pomija ostatni punkt
 * (closed ring duplicate).
 */
export function ringToMeters(
  ring: LngLat[],
  project: ReturnType<typeof localProjection>,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = []
  const n = ring.length
  // Pomiń ostatni duplikat closing.
  const limit = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]
    ? n - 1
    : n
  for (let i = 0; i < limit; i++) {
    out.push(project(ring[i][0], ring[i][1]))
  }
  return out
}

/**
 * Średnica (bounding box dimensions) footprintu w metrach. Używane do
 * sizingowania kamery w exploded view ("budynek ma 60x40m → kamera
 * 80m wstecz, FOV 50").
 */
export function footprintBbox(
  ring: LngLat[],
  project: ReturnType<typeof localProjection>,
): { width: number; depth: number; minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [lng, lat] of ring) {
    const { x, z } = project(lng, lat)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return {
    width: maxX - minX,
    depth: maxZ - minZ,
    minX,
    maxX,
    minZ,
    maxZ,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Exploded view — layout boxów per piętro
// ─────────────────────────────────────────────────────────────────────────

export type RoomBoxLayout = {
  roomId: string
  /** Wymiary w metrach. */
  width: number
  depth: number
  height: number
  /** Pozycja środka boxa względem origin'u piętra (środek footprintu). */
  x: number
  z: number
  /** Wykryta klasa pomieszczenia — używana do kolorowania w UI. */
  kind: 'aula' | 'lab' | 'standard'
  /** Wykryte "skrzydło" budynku (A/B/C…) z kodu — null gdy brak prefixu. */
  wing: string | null
}

/**
 * Wykrywa "skrzydło" z kodu sali. UJ kodyfikacje:
 *   - `A-101`, `B-205` — pierwsza litera = skrzydło
 *   - `A-0-04` (WGG) — j.w., litera przed myślnikiem
 *   - `0004`, `1.07` — brak skrzydła (cały budynek = jedno)
 */
function detectWing(code: string): string | null {
  const m = code.match(/^([A-Z])(?:[-.\s]|$)/)
  return m ? m[1] : null
}

/**
 * Wykrywa typ pomieszczenia z kodu/nazwy.
 *   - aula: "Aula", "Audytorium", lub capacity ≥ 150
 *   - lab: "Pracownia", "Lab" w notes — w MVP używamy tylko nazwy
 *   - standard: reszta
 */
function detectKind(
  code: string,
  capacity: number | null,
): RoomBoxLayout['kind'] {
  const lower = code.toLowerCase()
  if (lower.includes('aula') || lower.includes('audytorium')) return 'aula'
  if ((capacity ?? 0) >= 150) return 'aula'
  return 'standard'
}

/**
 * Klucz sortowania w obrębie skrzydła — wyciąga ostatnią liczbę z
 * kodu (101, 205, 04, 07…) i sortuje numerycznie. Stabilne dla
 * kodów typu "Aula Duża" (zwraca Infinity → na końcu listy).
 */
function sortKey(code: string): number {
  const matches = code.match(/(\d+)(?!.*\d)/)
  if (!matches) return Number.POSITIVE_INFINITY
  return Number.parseInt(matches[1], 10)
}

/**
 * Layout pomieszczeń na danym piętrze. Strategia:
 *
 *   1. Grupujemy po wykrytym `wing` (A/B/C…). Bez prefixu → jedna grupa.
 *   2. Aule (kind=aula) wyciągamy do osobnej "wstęgi" przy bottom edge —
 *      duże, jeden rząd na całej szerokości skrzydła.
 *   3. Pozostałe sale układamy w siatkę N kolumn × M rzędów w obrębie
 *      skrzydła, sortowane po sortKey.
 *   4. Skrzydła ułożone obok siebie (X axis), z lukami ~3m między nimi.
 *
 * Wymiary boxa zależą od `capacity` (auditorium 220 osób > sala 40 osób).
 * Aspekt ratio dla auli jest spłaszczony (theatre seating).
 */
export function layoutRoomBoxes(
  rooms: Array<{ id: string; code: string; capacity: number | null }>,
  footprintWidth: number,
  footprintDepth: number,
): RoomBoxLayout[] {
  if (rooms.length === 0) return []

  // ── 1. Pogrupuj po wing ────────────────────────────────────────────
  type Annotated = {
    id: string
    code: string
    capacity: number | null
    wing: string | null
    kind: RoomBoxLayout['kind']
    sortKey: number
  }
  const annotated: Annotated[] = rooms.map((r) => ({
    id: r.id,
    code: r.code,
    capacity: r.capacity,
    wing: detectWing(r.code),
    kind: detectKind(r.code, r.capacity),
    sortKey: sortKey(r.code),
  }))

  const wingsMap = new Map<string, Annotated[]>()
  for (const r of annotated) {
    const key = r.wing ?? '*'
    const list = wingsMap.get(key) ?? []
    list.push(r)
    wingsMap.set(key, list)
  }

  const wingKeys = Array.from(wingsMap.keys()).sort((a, b) => {
    if (a === '*') return 1
    if (b === '*') return -1
    return a.localeCompare(b)
  })

  // ── 2. Wymiary kanwy: 80% footprintu, margines na korytarze ─────────
  const usableW = Math.max(footprintWidth * 0.85, 20)
  const usableD = Math.max(footprintDepth * 0.85, 15)
  const wingGap = 2 // metry między skrzydłami

  // Equal split: każde skrzydło dostaje proporcjonalną szerokość po
  // pierwiastku z liczby sal (większe skrzydło → więcej miejsca).
  const wingWeights = wingKeys.map((k) => Math.sqrt(wingsMap.get(k)!.length))
  const totalWeight = wingWeights.reduce((a, b) => a + b, 0)
  const totalGap = wingGap * (wingKeys.length - 1)
  const wingWidths = wingWeights.map((w) => ((usableW - totalGap) * w) / totalWeight)

  const layouts: RoomBoxLayout[] = []

  let cursorX = -usableW / 2

  for (let wi = 0; wi < wingKeys.length; wi++) {
    const wingKey = wingKeys[wi]
    const wing = wingsMap.get(wingKey)!
    const wingW = wingWidths[wi]

    const aulas = wing.filter((r) => r.kind === 'aula').sort((a, b) => a.sortKey - b.sortKey)
    const others = wing.filter((r) => r.kind !== 'aula').sort((a, b) => a.sortKey - b.sortKey)

    // ── 2a. Aule — wstęga przy bottom edge (z= +usableD/2 - depth/2)
    const aulaBandD = aulas.length > 0 ? Math.min(usableD * 0.45, 14) : 0
    if (aulas.length > 0) {
      const eachW = (wingW - (aulas.length - 1) * 1.5) / aulas.length
      const aulaCenterZ = usableD / 2 - aulaBandD / 2 - 1
      for (let i = 0; i < aulas.length; i++) {
        const a = aulas[i]
        const capacityMult = a.capacity
          ? Math.max(0.9, Math.min(1.6, Math.sqrt(a.capacity / 120)))
          : 1.1
        const w = Math.min(eachW, 16) * Math.min(capacityMult, 1.3)
        const d = aulaBandD * Math.min(capacityMult, 1.2)
        const x = cursorX + i * (eachW + 1.5) + eachW / 2
        layouts.push({
          roomId: a.id,
          width: Math.max(6, w),
          depth: Math.max(5, d),
          height: 5, // aule wyższe — visual cue
          x,
          z: aulaCenterZ,
          kind: 'aula',
          wing: a.wing,
        })
      }
    }

    // ── 2b. Pozostałe — siatka na pozostałym kawałku
    const gridTop = -usableD / 2 + 1
    const gridBottom = aulas.length > 0
      ? usableD / 2 - aulaBandD - 2
      : usableD / 2 - 1
    const gridD = Math.max(gridBottom - gridTop, 8)

    if (others.length > 0) {
      // Liczba kolumn ~ proporcjonalnie do aspect ratio skrzydła.
      const aspect = wingW / gridD
      const cols = Math.max(1, Math.round(Math.sqrt(others.length * aspect)))
      const rows = Math.ceil(others.length / cols)
      const cellW = wingW / cols
      const cellD = gridD / rows

      for (let i = 0; i < others.length; i++) {
        const r = others[i]
        const col = i % cols
        const row = Math.floor(i / cols)
        const capacityMult = r.capacity
          ? Math.max(0.65, Math.min(1.5, Math.sqrt(r.capacity / 30)))
          : 0.9
        const w = Math.max(2.5, Math.min(cellW * 0.85, 8) * capacityMult)
        const d = Math.max(2.5, Math.min(cellD * 0.85, 8) * capacityMult)
        const x = cursorX + (col + 0.5) * cellW
        const z = gridTop + (row + 0.5) * cellD
        layouts.push({
          roomId: r.id,
          width: w,
          depth: d,
          height: 3,
          x,
          z,
          kind: r.kind,
          wing: r.wing,
        })
      }
    }

    cursorX += wingW + wingGap
  }

  return layouts
}

// ─────────────────────────────────────────────────────────────────────────
// Group rooms by floor — używane przez ExplodedBuildingView
// ─────────────────────────────────────────────────────────────────────────

export type FloorGroup = {
  level: number
  rooms: Array<{ id: string; code: string; capacity: number | null }>
}

/**
 * Pogrupuj pokoje wg `floor`. Pokoje bez `floor` (null) lądują na
 * level 0 (parter) — bezpieczne założenie, lepsze niż wyrzucić je.
 */
export function groupRoomsByFloor(
  rooms: Array<{ id: string; code: string; floor: number | null; capacity: number | null }>,
): FloorGroup[] {
  const map = new Map<number, FloorGroup['rooms']>()
  for (const r of rooms) {
    const level = r.floor ?? 0
    const list = map.get(level) ?? []
    list.push({ id: r.id, code: r.code, capacity: r.capacity })
    map.set(level, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([level, rs]) => ({ level, rooms: rs }))
}
