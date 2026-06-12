/**
 * discover-uj-osm.ts
 *
 * Pomocniczy skrypt: pyta Overpass o WSZYSTKIE budynki w okolicy
 * kampusu 600-lecia oraz starówki Krakowa, które mają jakikolwiek
 * sygnał że należą do UJ (`operator`, `name~Wydział|Collegium|UJ`,
 * `addr:housename` itp). Output: tabela `[osm_id, name, levels, height,
 * centroid_lat, centroid_lng]` posortowana po name.
 *
 * Używamy do ręcznego rebudowania mapowania `uj_id → osm_way_id` w
 * `fetch-uj-footprints.ts` (sekcja OSM_OVERRIDES). Z dokładnością do
 * konkretnego footprintu — bo "promień 35m wokół lat/lng" jak teraz
 * w niektórych miejscach (kampus 600-lecia) złapie sąsiedni budynek.
 *
 * Użycie:
 *   npm run uj-osm:discover
 *   npm run uj-osm:discover -- --area=600
 *   npm run uj-osm:discover -- --area=srodmiescie
 */

import process from 'node:process'

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

type Area = {
  key: string
  label: string
  bbox: [number, number, number, number] // [south, west, north, east]
}

const AREAS: Area[] = [
  {
    key: '600',
    label: 'Kampus 600-lecia (Łojasiewicza/Gronostajowa)',
    bbox: [50.0260, 19.8970, 50.0340, 19.9120],
  },
  {
    key: 'srodmiescie',
    label: 'Śródmieście UJ',
    bbox: [50.0590, 19.9180, 50.0680, 19.9410],
  },
]

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
  elements: OverpassElement[]
}

function buildQuery(bbox: [number, number, number, number]): string {
  const [s, w, n, e] = bbox
  // Wszystko co jest budynkiem I (ma operator zawierający 'Jagiell'
  // OR ma name zawierający Wydział/Collegium/UJ/Auditorium OR jest
  // amenity=university w danym obszarze).
  return (
    `[out:json][timeout:30];` +
    `(` +
      `way["building"]["operator"~"Jagiel|UJ",i](${s},${w},${n},${e});` +
      `way["building"]["name"~"Wydział|Collegium|Auditorium|Jagiel|UJ|Biblioteka Jagiel",i](${s},${w},${n},${e});` +
      `way["building"]["addr:housename"~"Wydział|Collegium",i](${s},${w},${n},${e});` +
      `relation["building"]["operator"~"Jagiel|UJ",i](${s},${w},${n},${e});` +
      `relation["building"]["name"~"Wydział|Collegium|Auditorium|Jagiel",i](${s},${w},${n},${e});` +
    `);out body;>;out skel qt;`
  )
}

async function fetchOnce(endpoint: string, query: string): Promise<OverpassResponse> {
  const body = `data=${encodeURIComponent(query)}`
  const res = await fetch(endpoint, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'ujverse-osm-discovery/1.0',
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
  }
  return (await res.json()) as OverpassResponse
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(query: string): Promise<OverpassResponse> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
    try {
      return await fetchOnce(endpoint, query)
    } catch (err) {
      lastErr = err
      const backoff = 3000 * 2 ** attempt
      console.warn(`  retry ${attempt + 1}/4 after ${backoff}ms (${(err as Error).message.slice(0, 60)})`)
      await sleep(backoff)
    }
  }
  throw lastErr
}

function centroid(coords: Array<[number, number]>): { lat: number; lng: number } {
  let lat = 0
  let lng = 0
  const n = coords.length - 1
  for (let i = 0; i < n; i++) {
    lng += coords[i][0]
    lat += coords[i][1]
  }
  return { lat: lat / n, lng: lng / n }
}

function buildAroundQuery(lat: number, lng: number, radius: number): string {
  // Wyciągamy WSZYSTKIE budynki w promieniu — bez filtrowania po
  // operator/name, bo dla wielu UJ buildingów OSM nie ma tych tagów.
  // Inspekcja ręczna decyduje który to nasz budynek.
  return (
    `[out:json][timeout:30];` +
    `(way["building"](around:${radius},${lat},${lng}););` +
    `out body;>;out skel qt;`
  )
}

async function listAround(lat: number, lng: number, radius: number) {
  console.log(`\n=== Wszystkie budynki w promieniu ${radius}m od (${lat}, ${lng}) ===\n`)
  const res = await fetchWithRetry(buildAroundQuery(lat, lng, radius))

  const nodes = new Map<number, OverpassNode>()
  for (const el of res.elements) {
    if (el.type === 'node') nodes.set(el.id, el)
  }

  const items: Array<{
    id: number
    name: string
    operator: string
    addr: string
    levels: string
    height: string
    lat: number
    lng: number
    distM: number
  }> = []

  for (const el of res.elements) {
    if (el.type !== 'way') continue
    const tags = el.tags ?? {}
    if (!tags['building']) continue
    const coords: Array<[number, number]> = []
    for (const nodeId of el.nodes) {
      const n = nodes.get(nodeId)
      if (!n) continue
      coords.push([n.lon, n.lat])
    }
    if (coords.length < 3) continue
    const c = centroid(coords)
    // Haversine distance
    const EARTH = 6_371_000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(c.lat - lat)
    const dLng = toRad(c.lng - lng)
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(c.lat)) * Math.sin(dLng / 2) ** 2
    const distM = 2 * EARTH * Math.asin(Math.sqrt(h))

    const addr = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
    items.push({
      id: el.id,
      name: tags['name'] ?? '(brak nazwy)',
      operator: tags['operator'] ?? '—',
      addr: addr || '—',
      levels: tags['building:levels'] ?? '—',
      height: tags['height'] ?? '—',
      lat: c.lat,
      lng: c.lng,
      distM,
    })
  }

  items.sort((a, b) => a.distM - b.distM)
  for (const b of items) {
    console.log(
      `${b.distM.toFixed(1).padStart(6)}m  way ${b.id.toString().padStart(11)}  ` +
      `${b.lat.toFixed(6)},${b.lng.toFixed(6)}  ` +
      `lvl=${b.levels.padStart(3)} h=${b.height.padStart(5)}  ` +
      `addr="${b.addr.padEnd(25)}"  ` +
      `name="${b.name}"  [op:${b.operator}]`,
    )
  }
  console.log(`\n(razem: ${items.length} budynków)\n`)
}

async function main() {
  const args = process.argv.slice(2)
  const around = args.find((a) => a.startsWith('--around='))?.slice('--around='.length)

  if (around) {
    const [latS, lngS, radS] = around.split(',')
    const lat = Number.parseFloat(latS)
    const lng = Number.parseFloat(lngS)
    const radius = Number.parseFloat(radS ?? '80')
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
      console.error('--around=lat,lng[,radius] — niepoprawny format')
      process.exit(1)
    }
    await listAround(lat, lng, radius)
    return
  }

  const filter = args.find((a) => a.startsWith('--area='))?.slice('--area='.length)
  const areas = filter ? AREAS.filter((a) => a.key === filter) : AREAS

  for (const area of areas) {
    console.log(`\n=== ${area.label} (bbox ${area.bbox.join(', ')}) ===\n`)
    const res = await fetchWithRetry(buildQuery(area.bbox))

    const nodes = new Map<number, OverpassNode>()
    for (const el of res.elements) {
      if (el.type === 'node') nodes.set(el.id, el)
    }

    const buildings: Array<{
      id: number
      name: string
      operator: string
      levels: string
      height: string
      lat: number
      lng: number
    }> = []

    for (const el of res.elements) {
      if (el.type !== 'way') continue
      const tags = el.tags ?? {}
      if (!tags['building']) continue
      const coords: Array<[number, number]> = []
      for (const nodeId of el.nodes) {
        const n = nodes.get(nodeId)
        if (!n) continue
        coords.push([n.lon, n.lat])
      }
      if (coords.length < 3) continue
      const c = centroid(coords)
      buildings.push({
        id: el.id,
        name: tags['name'] ?? '(brak nazwy)',
        operator: tags['operator'] ?? '—',
        levels: tags['building:levels'] ?? '—',
        height: tags['height'] ?? '—',
        lat: c.lat,
        lng: c.lng,
      })
    }

    buildings.sort((a, b) => a.name.localeCompare(b.name, 'pl'))

    for (const b of buildings) {
      console.log(
        `way ${b.id.toString().padStart(11)}  ${b.lat.toFixed(6)},${b.lng.toFixed(6)}  ` +
        `lvl=${b.levels.padStart(3)} h=${b.height.padStart(6)}  "${b.name}" [op:${b.operator}]`,
      )
    }
    console.log(`\n(razem: ${buildings.length} budynków UJ-podobnych)\n`)

    await sleep(2000)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
