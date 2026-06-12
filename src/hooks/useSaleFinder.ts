import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  haversineKm,
  listBuildings,
  listFloorPlansForBuilding,
  listRoomsForBuilding,
  searchSale,
  type Building,
  type FloorPlan,
  type Room,
  type SearchResult,
} from '../services/SaleFinderService'

const SEARCH_DEBOUNCE_MS = 180

type GeoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'granted'; lat: number; lng: number }
  | { status: 'denied'; message: string }

type SelectedTarget =
  | { kind: 'building'; building: Building }
  | { kind: 'room'; room: Room; building: Building }
  | null

/**
 * useSaleFinder — stan widoku Sale Finder (search + selection + geo).
 *
 * Zachowanie:
 *  - `query` jest debounced 180 ms; podczas debounce'u trzymamy poprzednie
 *    `results` żeby UI nie migało.
 *  - Kiedy `query` jest puste, `results` = [] i widok pokazuje listę
 *    wszystkich budynków (z `buildings`).
 *  - `select(target)` ustawia aktualnie podświetlony budynek/salę dla detail
 *    panelu (mapa, dystans, "Otwórz w Mapach"). Wybór sali ładuje listę
 *    pozostałych sal w tym budynku w tle.
 *  - Geolocation jest opt-in — uruchamiamy `requestGeo()` gdy user kliknie
 *    "pokaż dystans" (nie automatycznie przy mount, żeby nie wywoływać
 *    promptu zaraz po wejściu).
 */
export function useSaleFinder() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [buildingsLoading, setBuildingsLoading] = useState(true)
  const [buildingsError, setBuildingsError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const [selected, setSelected] = useState<SelectedTarget>(null)
  const [siblingRooms, setSiblingRooms] = useState<Room[]>([])
  const [siblingRoomsLoading, setSiblingRoomsLoading] = useState(false)

  // Plany pięter dla aktualnie wybranego budynku. Ładowane razem z
  // sibling rooms — jedna selekcja = dwa zapytania równolegle.
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
  const [floorPlansLoading, setFloorPlansLoading] = useState(false)
  // Aktywny poziom (level) — null gdy budynek nie ma żadnych planów.
  // Domyślnie: poziom wybranej sali jeśli ma plan, inaczej parter (0)
  // jeśli istnieje, inaczej najniższy dostępny.
  const [activeLevel, setActiveLevel] = useState<number | null>(null)

  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })

  // ── Lista budynków: pobierz raz przy mount ────────────────────────────
  useEffect(() => {
    let cancelled = false
    setBuildingsLoading(true)
    setBuildingsError(null)
    listBuildings()
      .then((data) => {
        if (cancelled) return
        setBuildings(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setBuildingsError(err instanceof Error ? err.message : 'Nie udało się pobrać budynków UJ.')
      })
      .finally(() => {
        if (!cancelled) setBuildingsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Debounce query ────────────────────────────────────────────────────
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [query])

  // ── Search ────────────────────────────────────────────────────────────
  const searchTokenRef = useRef(0)
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setSearching(false)
      return
    }
    const token = ++searchTokenRef.current
    setSearching(true)
    searchSale(debouncedQuery)
      .then((hits) => {
        if (token !== searchTokenRef.current) return
        setResults(hits)
      })
      .catch(() => {
        if (token !== searchTokenRef.current) return
        setResults([])
      })
      .finally(() => {
        if (token === searchTokenRef.current) setSearching(false)
      })
  }, [debouncedQuery])

  // ── Sibling rooms + floor plans (równolegle, na zmianę selected) ──────
  const siblingTokenRef = useRef(0)
  useEffect(() => {
    if (!selected) {
      setSiblingRooms([])
      setFloorPlans([])
      setActiveLevel(null)
      return
    }
    const buildingId = selected.building.id
    const targetRoomLevel = selected.kind === 'room' ? selected.room.floor : null

    const token = ++siblingTokenRef.current
    setSiblingRoomsLoading(true)
    setFloorPlansLoading(true)

    Promise.allSettled([
      listRoomsForBuilding(buildingId),
      listFloorPlansForBuilding(buildingId),
    ])
      .then(([roomsRes, plansRes]) => {
        if (token !== siblingTokenRef.current) return

        const rooms =
          roomsRes.status === 'fulfilled' ? roomsRes.value : []
        const plans =
          plansRes.status === 'fulfilled' ? plansRes.value : []

        setSiblingRooms(rooms)
        setFloorPlans(plans)

        // Choose initial active level:
        //   1. Wybrana sala ma poziom + plan na tym poziomie istnieje
        //   2. Parter (0) ma plan
        //   3. Najniższy poziom z planem
        //   4. null (budynek bez planów)
        if (plans.length === 0) {
          setActiveLevel(null)
        } else if (
          targetRoomLevel !== null &&
          plans.some((p) => p.level === targetRoomLevel)
        ) {
          setActiveLevel(targetRoomLevel)
        } else if (plans.some((p) => p.level === 0)) {
          setActiveLevel(0)
        } else {
          setActiveLevel(plans[0].level)
        }
      })
      .finally(() => {
        if (token !== siblingTokenRef.current) return
        setSiblingRoomsLoading(false)
        setFloorPlansLoading(false)
      })
  }, [selected])

  const select = useCallback((target: SelectedTarget) => {
    setSelected(target)
  }, [])

  const clearSelection = useCallback(() => setSelected(null), [])

  const requestGeo = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({ status: 'denied', message: 'Twoja przeglądarka nie wspiera geolokalizacji.' })
      return
    }
    setGeo({ status: 'requesting' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: 'granted',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      (err) => {
        setGeo({
          status: 'denied',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Brak zgody na lokalizację. Możesz dodać ją ręcznie w przeglądarce.'
              : 'Nie udało się ustalić Twojej lokalizacji.',
        })
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    )
  }, [])

  // ── Computed ──────────────────────────────────────────────────────────
  const userLocation = useMemo(() => {
    if (geo.status !== 'granted') return null
    return { lat: geo.lat, lng: geo.lng }
  }, [geo])

  const distanceKmTo = useCallback(
    (point: { lat: number; lng: number }): number | null => {
      if (!userLocation) return null
      return haversineKm(userLocation, point)
    },
    [userLocation],
  )

  /** Plan dla aktywnego poziomu lub `null` gdy budynek nie ma planów. */
  const activePlan = useMemo<FloorPlan | null>(() => {
    if (activeLevel === null) return null
    return floorPlans.find((p) => p.level === activeLevel) ?? null
  }, [floorPlans, activeLevel])

  return {
    buildings,
    buildingsLoading,
    buildingsError,
    query,
    setQuery,
    results,
    searching,
    selected,
    select,
    clearSelection,
    siblingRooms,
    siblingRoomsLoading,
    floorPlans,
    floorPlansLoading,
    activeLevel,
    setActiveLevel,
    activePlan,
    geo,
    userLocation,
    requestGeo,
    distanceKmTo,
  }
}
