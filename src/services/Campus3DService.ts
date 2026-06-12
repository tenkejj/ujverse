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

/**
 * Oblicza orientację budynku (radiany) — kąt najdłuższej krawędzi
 * w stosunku do osi X.
 *
 * Po co? Budynki UJ na mapie są obrócone pod różnymi kątami (Łojasiewicza
 * ~30°, Bracka pod 70°, itd.). `layoutFloor` placuje sale w axis-aligned
 * gridzie (bbox-relative). Dla obróconego budynku axis-aligned bbox jest
 * dużo większy niż realny kształt → sale wylatują poza polygon i wyglądają
 * jakby wisiały w powietrzu.
 *
 * Rozwiązanie: obróć cały footprint o `-orientation` przed bbox/shape
 * generowaniem. Wtedy budynek jest osiowo wyrównany, bbox jest ciasny,
 * a sale lądują wewnątrz.
 *
 * Implementacja: weight'owana suma kątów wszystkich krawędzi (każda
 * krawędź wnosi swój kąt * długość). Stable dla L/U-shaped builds gdzie
 * główna oś nie jest jedną dominującą krawędzią. Kąty są mapowane modulo
 * π/2 (90°) bo prostokąt ma 4 krawędzie pod 90° do siebie — wszystkie
 * "głosują" na ten sam kierunek.
 */
export function computeFootprintOrientation(
  meters: Array<{ x: number; z: number }>,
): number {
  if (meters.length < 3) return 0
  // Sumujemy wektory (cos2θ, sin2θ) ważone długością krawędzi — kąty
  // doubled żeby krawędź pod 0° i 90° (przeciwległe boki prostokąta)
  // zmapowały się na ten sam vector. Następnie atan2/2 daje principal axis.
  let sumCos = 0
  let sumSin = 0
  for (let i = 0; i < meters.length; i++) {
    const a = meters[i]
    const b = meters[(i + 1) % meters.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.1) continue
    const angle = Math.atan2(dz, dx)
    sumCos += Math.cos(2 * angle) * len
    sumSin += Math.sin(2 * angle) * len
  }
  return Math.atan2(sumSin, sumCos) / 2
}

/**
 * Obróć ring punktów {x,z} o `angle` (radiany) wokół (0,0).
 * Używane w exploded view do wyrównania budynku do osi X.
 */
export function rotateMeters(
  meters: Array<{ x: number; z: number }>,
  angle: number,
): Array<{ x: number; z: number }> {
  if (Math.abs(angle) < 1e-6) return meters
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return meters.map(({ x, z }) => ({
    x: x * c - z * s,
    z: x * s + z * c,
  }))
}

/**
 * Bbox dla już zaprojektowanego ringu meters (po opcjonalnej rotacji).
 */
export function bboxOfMeters(
  meters: Array<{ x: number; z: number }>,
): { width: number; depth: number; minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const { x, z } of meters) {
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
 * Reprezentacja korytarza wewnątrz budynku — wąski pas między rzędami
 * pomieszczeń. Wizualnie ciemniejszy/podświetlony pas na podłodze
 * piętra; nie jest klikalny ani interaktywny.
 */
export type CorridorLayout = {
  x: number
  z: number
  width: number
  depth: number
}

/**
 * Wynik layoutu pojedynczego piętra. Oddzielone sale + korytarze, bo
 * `FloorPlane` renderuje je osobno (sale = klikalne boxy, korytarze =
 * dekoracyjne ścieżki na podłodze).
 */
export type FloorLayout = {
  rooms: RoomBoxLayout[]
  corridors: CorridorLayout[]
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
export function detectKind(
  code: string,
  capacity: number | null,
): RoomBoxLayout['kind'] {
  const lower = code.toLowerCase()
  if (lower.includes('aula') || lower.includes('audytorium')) return 'aula'
  if (lower.includes('lab') || lower.includes('pracownia')) return 'lab'
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
 * Layout pomieszczeń na danym piętrze — bardziej "realny" rozkład niż
 * grid sloty. Wzorowany na typowym układzie wydziałów UJ:
 *
 *   - **Skrzydła**: rooms grupowane po `wing` (A/B/C…) z kodu.
 *   - **Centralny korytarz**: każdy "rząd" sal ma korytarz biegnący
 *     przez środek skrzydła (oś X). Sale lokowane po obu jego stronach.
 *   - **Aule na "froncie"**: rooms `kind=aula` lokowane przy krawędzi
 *     +Z (frontowa "ściana" skrzydła) jako szeroka wstęga.
 *   - **Wypełnianie**: sale rozszerzają się tak żeby WYPEŁNIAĆ skrzydło
 *     (bez gigantycznej pustki w środku) — wcześniej max cap 8m sprawiał
 *     że duże footprinty wyglądały na puste.
 *
 * Zwraca rooms + corridors — FloorPlane renderuje rooms jako klikalne
 * boxy, a corridors jako ciemniejsze pasy na podłodze (dekoracja).
 *
 * Wymiary boxa nadal zależą od capacity (auditorium > sala ćwiczeniowa),
 * ale teraz szerokość/głębokość zależy też od ile sal jest w kolumnie.
 *
 * Edge case: gdy w skrzydle 1 sala → wypełnia całe skrzydło bez korytarza.
 */
export function layoutFloor(
  rooms: Array<{ id: string; code: string; capacity: number | null }>,
  footprintWidth: number,
  footprintDepth: number,
): FloorLayout {
  if (rooms.length === 0) return { rooms: [], corridors: [] }

  // ── 1. Pogrupuj po wing + annotuj ──────────────────────────────────
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

  // ── 2. Wymiary użytkowe — wypełniamy 92% footprintu (ściany zewnętrzne)
  const wallThickness = 0.6 // grubość zewn. ściany (metry)
  const usableW = Math.max(footprintWidth - 2 * wallThickness, 12)
  const usableD = Math.max(footprintDepth - 2 * wallThickness, 8)
  const wingGap = 1.5 // metry między skrzydłami (poprzeczny "łącznik")

  // Każde skrzydło dostaje proporcjonalną szerokość — większe skrzydło
  // (więcej sal) → szersze.
  const wingWeights = wingKeys.map((k) => Math.max(1, wingsMap.get(k)!.length))
  const totalWeight = wingWeights.reduce((a, b) => a + b, 0)
  const totalGap = wingGap * (wingKeys.length - 1)
  const wingWidths = wingWeights.map((w) => ((usableW - totalGap) * w) / totalWeight)

  const layouts: RoomBoxLayout[] = []
  const corridors: CorridorLayout[] = []

  // Standardowa wysokość sali — wystarczy żeby było widać "piętro",
  // ale niżej od high-ceiling auli.
  const ROOM_H = 3.2
  const AULA_H = 4.5

  let cursorX = -usableW / 2

  for (let wi = 0; wi < wingKeys.length; wi++) {
    const wingKey = wingKeys[wi]
    const wing = wingsMap.get(wingKey)!
    const wingW = wingWidths[wi]

    const wingLeftX = cursorX
    const wingCenterX = cursorX + wingW / 2

    const aulas = wing.filter((r) => r.kind === 'aula').sort((a, b) => a.sortKey - b.sortKey)
    const others = wing.filter((r) => r.kind !== 'aula').sort((a, b) => a.sortKey - b.sortKey)

    // ── 2a. Aule — wstęga przy "froncie" (+Z edge) ─────────────────────
    // Realne wymiary auli UJ: 10-22m szer × 8-14m głęb (zależnie od capacity).
    // Bez stretching — gdy budynek jest duży a aula mała, NIE rozciągamy
    // jej na całe skrzydło (lepiej zostawić "niezindeksowany" obszar).
    const aulaBandD = aulas.length > 0
      ? Math.min(Math.max(usableD * 0.28, 8), 14)
      : 0
    if (aulas.length > 0) {
      const aulaCenterZ = usableD / 2 - aulaBandD / 2
      const eachW = Math.min(wingW / aulas.length, 24)
      const startX = wingLeftX + (wingW - eachW * aulas.length) / 2
      for (let i = 0; i < aulas.length; i++) {
        const a = aulas[i]
        // Capacity → rozmiar: 50 osób ~ 60m², 300 osób ~ 200m².
        const cap = a.capacity ?? 100
        const targetArea = 0.55 * cap + 30 // m²
        const aspect = 1.4 // wider than deep (theatre seating)
        const idealD = Math.sqrt(targetArea / aspect)
        const idealW = idealD * aspect
        const w = Math.max(8, Math.min(eachW - 0.6, idealW, 22))
        const d = Math.max(6, Math.min(aulaBandD - 0.6, idealD, 14))
        const x = startX + (i + 0.5) * eachW
        layouts.push({
          roomId: a.id,
          width: w,
          depth: d,
          height: AULA_H,
          x,
          z: aulaCenterZ,
          kind: 'aula',
          wing: a.wing,
        })
      }
    }

    // ── 2b. Pozostałe sale — centralny korytarz + sale po obu stronach
    const remainingTopZ = -usableD / 2
    const remainingBottomZ = aulas.length > 0
      ? usableD / 2 - aulaBandD - 1.2
      : usableD / 2
    const remainingD = remainingBottomZ - remainingTopZ

    if (others.length > 0 && remainingD > 4) {
      // Decyzja: pojedyncza kolumna (gdy skrzydło wąskie lub mało sal),
      // czy dwie kolumny z korytarzem.
      const wantTwoColumns = wingW >= 10 && others.length >= 3
      const corridorW = wantTwoColumns ? Math.min(2.0, wingW * 0.15) : 0

      if (wantTwoColumns) {
        // Korytarz pionowo (oś Z) na środku skrzydła.
        corridors.push({
          x: wingCenterX,
          z: (remainingTopZ + remainingBottomZ) / 2,
          width: corridorW,
          depth: remainingD,
        })

        const colW = (wingW - corridorW) / 2
        // Naprzemiennie: parzyste → lewa kolumna, nieparzyste → prawa.
        // Daje równomiernie rozłożone numery sal po obu stronach.
        const leftCol: Annotated[] = []
        const rightCol: Annotated[] = []
        for (let i = 0; i < others.length; i++) {
          ;(i % 2 === 0 ? leftCol : rightCol).push(others[i])
        }
        layoutColumn(
          leftCol,
          wingLeftX + colW / 2,
          remainingTopZ,
          remainingBottomZ,
          colW,
          ROOM_H,
          layouts,
        )
        layoutColumn(
          rightCol,
          wingLeftX + colW + corridorW + colW / 2,
          remainingTopZ,
          remainingBottomZ,
          colW,
          ROOM_H,
          layouts,
        )
      } else {
        // Pojedyncza kolumna — sale wypełniają całą szerokość skrzydła.
        layoutColumn(
          others,
          wingCenterX,
          remainingTopZ,
          remainingBottomZ,
          wingW,
          ROOM_H,
          layouts,
        )
      }
    }

    cursorX += wingW + wingGap

    // Łącznik korytarza między skrzydłami (poziomo, oś X) — gdy >1 wing.
    if (wi < wingKeys.length - 1) {
      corridors.push({
        x: cursorX - wingGap / 2,
        z: 0,
        width: wingGap,
        depth: usableD,
      })
    }
  }

  return { rooms: layouts, corridors }
}

/**
 * Helper: rozłóż listę sal wzdłuż osi Z (pionowej) w obrębie wąskiej
 * kolumny szerokości `colW`, centrowanej na `centerX`.
 *
 * Strategia: REALNE rozmiary klas (nie stretching!).
 *   - Sala 20-30 osób (ćwiczenia) → ~6m × 5m
 *   - Sala 50-80 osób (wykład mały) → ~8m × 6m
 *   - Lab komputerowy → ~9m × 7m
 *
 * Gdy `rooms` zajmuje mniej niż dostępna głębokość, układamy je od góry
 * i ZOSTAWIAMY pustą przestrzeń na dole — UI renderuje to jako hatched
 * pattern "niezindeksowane". Lepsze niż stretching 3 sal na 40m budynek.
 *
 * Gdy `rooms` jest za dużo, kompresujemy proporcjonalnie (rzadkie).
 */
function layoutColumn(
  rooms: Array<{ id: string; capacity: number | null; wing: string | null; kind: RoomBoxLayout['kind'] }>,
  centerX: number,
  topZ: number,
  bottomZ: number,
  colW: number,
  height: number,
  out: RoomBoxLayout[],
) {
  if (rooms.length === 0) return
  const totalD = bottomZ - topZ
  const gap = 0.4

  // Krok 1: wylicz realny rozmiar każdej sali (capacity → metry).
  const items = rooms.map((r) => {
    const cap = r.capacity ?? 30
    // Linear interp: cap 15 → 4.5m, cap 50 → 6.5m, cap 100 → 8.5m (capped)
    const targetD = Math.max(4.0, Math.min(8.5, 4.0 + cap * 0.045))
    return { ...r, targetD }
  })

  // Krok 2: sprawdź czy mieści się. Jeśli nie — skaluj proporcjonalnie down.
  const totalNeeded = items.reduce((sum, it) => sum + it.targetD + gap, -gap)
  const scale = totalNeeded > totalD ? totalD / totalNeeded : 1

  // Sale ułożone od góry kolumny (z= topZ), pustka na dole zostaje.
  let zCursor = topZ + (gap / 2)
  for (const item of items) {
    const d = item.targetD * scale
    // Szerokość: cap na 8.5m (max realny class), nie cała szerokość kolumny.
    const w = Math.min(colW - 0.6, 8.5)
    const zCenter = zCursor + d / 2
    out.push({
      roomId: item.id,
      width: Math.max(3, w),
      depth: Math.max(3, d),
      height,
      x: centerX,
      z: zCenter,
      kind: item.kind,
      wing: item.wing,
    })
    zCursor += d + gap * scale
  }
}

/**
 * Backward-compat alias dla starego API. Zwraca tylko sale.
 * @deprecated Użyj `layoutFloor` żeby dostać też corridors.
 */
export function layoutRoomBoxes(
  rooms: Array<{ id: string; code: string; capacity: number | null }>,
  footprintWidth: number,
  footprintDepth: number,
): RoomBoxLayout[] {
  return layoutFloor(rooms, footprintWidth, footprintDepth).rooms
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
