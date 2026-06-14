import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  haversineKm,
  listBuildings,
  listRoomsForBuilding,
  searchSale,
  type Building,
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
 * Bezpośrednio konsumowany przez `SaleFinderView` (route `/sale`). Wcześniej
 * istniał adapter `useCampus3D` dodający URL-state sync dla 3D exploded view —
 * po wycięciu fake-3D adapter jest niepotrzebny, selekcja jest efemeryczna.
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

  // ── Sibling rooms — sale w tym samym budynku ──────────────────────────
  const siblingTokenRef = useRef(0)
  useEffect(() => {
    if (!selected) {
      setSiblingRooms([])
      return
    }
    const buildingId = selected.building.id
    const token = ++siblingTokenRef.current
    setSiblingRoomsLoading(true)

    listRoomsForBuilding(buildingId)
      .then((rooms) => {
        if (token !== siblingTokenRef.current) return
        setSiblingRooms(rooms)
      })
      .catch(() => {
        if (token !== siblingTokenRef.current) return
        setSiblingRooms([])
      })
      .finally(() => {
        if (token !== siblingTokenRef.current) return
        setSiblingRoomsLoading(false)
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
    geo,
    userLocation,
    requestGeo,
    distanceKmTo,
  }
}
