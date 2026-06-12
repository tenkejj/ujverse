import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSaleFinder } from './useSaleFinder'
import { listRoomsForBuilding, type Room } from '../services/SaleFinderService'

/**
 * useCampus3D — stan i nawigacja dla widoku Campus 3D.
 *
 * Łączy:
 *   - search/buildings/geo z `useSaleFinder` (delegacja, nie reimplementacja
 *     — search działa identycznie),
 *   - własny stan: `selectedBuildingId`, `exploded`, `selectedRoomId`,
 *     `siblingRooms` (sale w wybranym budynku).
 *   - URL state sync — query stringa `?b=<id>&exploded=1&r=<room-id>`.
 *     Zgodne z regułą architektury #2 (bez Routes, używamy useLocation
 *     + navigate pattern z App.tsx).
 *
 * Discovery: pierwszy render czyta z URL, nastepne change'e popychają
 * URL przez `navigate(..., { replace: true })` żeby histroia nie miała
 * 20 wpisów per session.
 *
 * Selection sync z `useSaleFinder.selected`:
 *   - Gdy user wybierze coś z search panelu (`select(building|room)`),
 *     przepisujemy do naszego `selectedBuildingId`/`selectedRoomId`.
 *   - Odwrotnie też — klik na budynek na mapie ustawia tylko
 *     `selectedBuildingId`, zostawia `selected` z useSaleFinder w spoczynku
 *     (do search nawigacji).
 */
export function useCampus3D() {
  const finder = useSaleFinder()
  const location = useLocation()
  const navigate = useNavigate()

  // ── Read initial state from URL ───────────────────────────────────────
  const initialFromUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return { buildingId: null, exploded: false, roomId: null }
    }
    const params = new URLSearchParams(window.location.search)
    return {
      buildingId: params.get('b'),
      exploded: params.get('exploded') === '1',
      roomId: params.get('r'),
    }
  }, [])

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    initialFromUrl.buildingId,
  )
  const [exploded, setExploded] = useState(initialFromUrl.exploded)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    initialFromUrl.roomId,
  )
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null)

  // ── Sibling rooms — sale w wybranym budynku ──────────────────────────
  const [siblingRooms, setSiblingRooms] = useState<Room[]>([])
  const [siblingRoomsLoading, setSiblingRoomsLoading] = useState(false)
  const siblingTokenRef = useRef(0)

  useEffect(() => {
    if (!selectedBuildingId) {
      setSiblingRooms([])
      return
    }
    const token = ++siblingTokenRef.current
    setSiblingRoomsLoading(true)
    listRoomsForBuilding(selectedBuildingId)
      .then((rooms) => {
        if (token !== siblingTokenRef.current) return
        setSiblingRooms(rooms)
      })
      .catch((err) => {
        if (token !== siblingTokenRef.current) return
        console.warn('[Campus3D] failed to load rooms for building:', err)
        setSiblingRooms([])
      })
      .finally(() => {
        if (token === siblingTokenRef.current) setSiblingRoomsLoading(false)
      })
  }, [selectedBuildingId])

  // ── URL sync — zapisuj zmiany jako query string ──────────────────────
  // Skip first effect run (initialization odczytała state z URL, nie chcemy
  // robić navigate(replace) zaraz na starcie z tym samym URL).
  const skipFirstSyncRef = useRef(true)
  useEffect(() => {
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false
      return
    }
    const params = new URLSearchParams()
    if (selectedBuildingId) params.set('b', selectedBuildingId)
    if (exploded) params.set('exploded', '1')
    if (selectedRoomId) params.set('r', selectedRoomId)
    const search = params.toString()
    const target = `${location.pathname}${search ? `?${search}` : ''}`
    // Replace żeby historyback nie skakał po sub-stanach widoku.
    navigate(target, { replace: true })
  }, [selectedBuildingId, exploded, selectedRoomId, location.pathname, navigate])

  // ── Building / Room lookups ──────────────────────────────────────────
  const selectedBuilding = useMemo(() => {
    if (!selectedBuildingId) return null
    return finder.buildings.find((b) => b.id === selectedBuildingId) ?? null
  }, [selectedBuildingId, finder.buildings])

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null
    return siblingRooms.find((r) => r.id === selectedRoomId) ?? null
  }, [selectedRoomId, siblingRooms])

  // ── Search → 3D sync ─────────────────────────────────────────────────
  // Kiedy user klikie w search panel (useSaleFinder.select), przepisujemy
  // do naszego stanu. Watchujemy referencję `selected` żeby nie zlewać
  // z naszymi własnymi mutacjami.
  const lastFinderSelectionRef = useRef(finder.selected)
  useEffect(() => {
    const current = finder.selected
    if (current === lastFinderSelectionRef.current) return
    lastFinderSelectionRef.current = current
    if (current === null) return

    if (current.kind === 'building') {
      setSelectedBuildingId(current.building.id)
      setSelectedRoomId(null)
      setExploded(false)
    } else {
      setSelectedBuildingId(current.building.id)
      setSelectedRoomId(current.room.id)
      setExploded(true) // klik w salę = rozwiń budynek
    }
  }, [finder.selected])

  // ── Public mutators ──────────────────────────────────────────────────
  const selectBuilding = useCallback((id: string | null) => {
    setSelectedBuildingId(id)
    if (id === null) {
      setSelectedRoomId(null)
      setExploded(false)
    } else {
      // Wybór nowego budynku — wyczyść poprzedni room.
      setSelectedRoomId(null)
    }
  }, [])

  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId)
    if (roomId) setExploded(true)
  }, [])

  const toggleExploded = useCallback(() => {
    setExploded((prev) => !prev)
  }, [])

  const clear = useCallback(() => {
    setSelectedBuildingId(null)
    setSelectedRoomId(null)
    setExploded(false)
    finder.clearSelection()
  }, [finder])

  return {
    // From useSaleFinder — search + geo + buildings list.
    buildings: finder.buildings,
    buildingsLoading: finder.buildingsLoading,
    buildingsError: finder.buildingsError,
    query: finder.query,
    setQuery: finder.setQuery,
    results: finder.results,
    searching: finder.searching,
    selectFromSearch: finder.select,
    geo: finder.geo,
    userLocation: finder.userLocation,
    requestGeo: finder.requestGeo,
    distanceKmTo: finder.distanceKmTo,

    // 3D-specific.
    selectedBuildingId,
    selectedBuilding,
    selectBuilding,
    hoveredBuildingId,
    setHoveredBuildingId,
    siblingRooms,
    siblingRoomsLoading,
    selectedRoomId,
    selectedRoom,
    selectRoom,
    exploded,
    setExploded,
    toggleExploded,
    clear,
  }
}

export type UseCampus3DReturn = ReturnType<typeof useCampus3D>
