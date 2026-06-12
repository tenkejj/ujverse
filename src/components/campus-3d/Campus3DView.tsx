import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Building2,
  Compass,
  Crosshair,
  ExternalLink,
  Hash,
  Layers,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useCampus3D } from '../../hooks/useCampus3D'
import {
  formatDistance,
  googleMapsDirectionsUrl,
  walkingMinutes,
  type Building,
  type Room,
  type SearchResult,
} from '../../services/SaleFinderService'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import { sectionTitleCls, sideMutedCls, widgetGoldCls } from '../../lib/sidePanelStyles'
import MapLibreCanvas from './MapLibreCanvas'

// Three.js scene jest ciężki (~600KB gzipped). Ładujemy go DOPIERO gdy user
// otworzy exploded view — pierwsza ramka mapy 3D nie czeka na r3f.
const ExplodedBuildingView = lazy(() => import('./ExplodedBuildingView'))

/**
 * Campus3DView — top-level widok 3D mapy kampusu UJ.
 *
 * Layout (desktop ≥ lg):
 *   ┌─────────────────┬─────────────────────────┐
 *   │ Search + lista  │ MapLibre 3D canvas      │
 *   │ + detail panel  │ (full height)           │
 *   │ (sticky)        │                         │
 *   └─────────────────┴─────────────────────────┘
 *
 * Layout (mobile):
 *   ┌─────────────────────────────────────────┐
 *   │ Search bar (sticky top)                 │
 *   ├─────────────────────────────────────────┤
 *   │ MapLibre 3D canvas (60% viewport)       │
 *   ├─────────────────────────────────────────┤
 *   │ Wyniki / detail panel (przewijalne)     │
 *   └─────────────────────────────────────────┘
 *
 * Selekcja flow:
 *   1. Klik w budynek na mapie / w wyniku search → `selectBuilding(id)`.
 *   2. Mapa flyTo na zoom 18, panel detail się pojawia.
 *   3. Klik "Pokaż wnętrza" → `setExploded(true)`, lazy load
 *      `ExplodedBuildingView` w modal overlay.
 *   4. Klik w salę w exploded → `selectRoom(id)`, highlight.
 *   5. ESC / X → `clear()` zwija wszystko.
 */

const CAMPUS_LABELS: Record<string, string> = {
  '600-lecia': 'Kampus 600-lecia',
  srodmiescie: 'Śródmieście',
  medyczny: 'Collegium Medicum',
}

const CAMPUS_ORDER: ReadonlyArray<string> = ['600-lecia', 'srodmiescie', 'medyczny']

function describeFloor(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return ''
  if (floor === 0) return 'parter'
  if (floor < 0) return `piwnica (${floor})`
  return `${floor}. piętro`
}

type Props = {
  /** Opcjonalny callback do nawigacji powrotnej (mobile back). */
  onBack?: () => void
}

export default function Campus3DView(_props: Props) {
  const c3d = useCampus3D()
  const {
    buildings,
    buildingsLoading,
    buildingsError,
    query,
    setQuery,
    results,
    searching,
    selectFromSearch,
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
    toggleExploded,
    setExploded,
    clear,
    geo,
    requestGeo,
    userLocation,
    distanceKmTo,
  } = c3d

  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Lista budynków po kampusie ────────────────────────────────────────
  const buildingsByCampus = useMemo(() => {
    const groups = new Map<string, Building[]>()
    for (const b of buildings) {
      const key = b.campus ?? 'inne'
      const list = groups.get(key) ?? []
      list.push(b)
      groups.set(key, list)
    }
    const ordered: Array<{ key: string; label: string; items: Building[] }> = []
    for (const key of CAMPUS_ORDER) {
      const items = groups.get(key)
      if (items && items.length > 0) {
        ordered.push({ key, label: CAMPUS_LABELS[key] ?? key, items })
        groups.delete(key)
      }
    }
    for (const [key, items] of groups) {
      ordered.push({ key, label: CAMPUS_LABELS[key] ?? 'Inne', items })
    }
    return ordered
  }, [buildings])

  const showResultsList = query.trim().length > 0
  const showEmptyResults =
    showResultsList && !searching && results.length === 0 && !buildingsLoading

  // ── ESC handler — zwija exploded → selection → clear ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (exploded) {
        setExploded(false)
        return
      }
      if (selectedBuildingId) {
        clear()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [exploded, selectedBuildingId, setExploded, clear])

  // ── Render helpers ────────────────────────────────────────────────────

  const renderSearchResultRow = (hit: SearchResult, idx: number) => {
    const isSelected =
      hit.kind === 'building'
        ? selectedBuildingId === hit.building.id && !selectedRoomId
        : selectedRoomId === hit.room.id

    if (hit.kind === 'building') {
      const dist = distanceKmTo(hit.building)
      return (
        <BaseCard
          key={`b:${hit.building.id}:${idx}`}
          variant="inner"
          interactive
          as="button"
          onClick={() => selectFromSearch({ kind: 'building', building: hit.building })}
          className={`w-full text-left p-3 flex items-start gap-2.5 ${
            isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
          }`}
        >
          <Building2 size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${widgetGoldCls}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                {hit.building.name}
              </p>
              {hit.building.short_name && (
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {hit.building.short_name}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
              {hit.building.address}
            </p>
            {dist !== null && (
              <p className="mt-1 text-[11px] font-medium text-[#1e293b] dark:text-brand-gold-bright">
                {formatDistance(dist)} · ~{walkingMinutes(dist)} min pieszo
              </p>
            )}
          </div>
        </BaseCard>
      )
    }

    const dist = distanceKmTo(hit.building)
    return (
      <BaseCard
        key={`r:${hit.room.id}:${idx}`}
        variant="inner"
        interactive
        as="button"
        onClick={() => selectFromSearch({ kind: 'room', room: hit.room, building: hit.building })}
        className={`w-full text-left p-3 flex items-start gap-2.5 ${
          isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <Hash size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${widgetGoldCls}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
              Sala {hit.room.code}
            </p>
            {hit.room.display_name && hit.room.display_name !== `Sala ${hit.room.code}` && (
              <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                {hit.room.display_name}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
            {hit.building.name} · {hit.building.address}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {hit.room.floor !== null && (
              <span className="inline-flex items-center gap-1">
                <Layers size={11} strokeWidth={2} aria-hidden />
                {describeFloor(hit.room.floor)}
              </span>
            )}
            {hit.room.capacity !== null && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} strokeWidth={2} aria-hidden />
                {hit.room.capacity}
              </span>
            )}
            {dist !== null && (
              <span className="font-medium text-[#1e293b] dark:text-brand-gold-bright">
                {formatDistance(dist)} · ~{walkingMinutes(dist)} min
              </span>
            )}
          </div>
        </div>
      </BaseCard>
    )
  }

  const renderBuildingTile = (building: Building) => {
    const isSelected = selectedBuildingId === building.id
    const dist = distanceKmTo(building)
    return (
      <BaseCard
        key={building.id}
        variant="inner"
        interactive
        as="button"
        onClick={() => selectBuilding(building.id)}
        onMouseEnter={() => setHoveredBuildingId(building.id)}
        onMouseLeave={() => setHoveredBuildingId(null)}
        className={`w-full text-left p-3 flex items-start gap-2.5 ${
          isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <Building2 size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${widgetGoldCls}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
              {building.name}
            </p>
            {building.short_name && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {building.short_name}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 truncate">
            {building.address}
          </p>
          {dist !== null && (
            <p className="mt-1 text-[11px] font-medium text-[#1e293b] dark:text-brand-gold-bright">
              {formatDistance(dist)} · ~{walkingMinutes(dist)} min pieszo
            </p>
          )}
        </div>
      </BaseCard>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <MapPin size={14} strokeWidth={2} className={widgetGoldCls} aria-hidden />
          <span className={sectionTitleCls}>Mapa 3D · Kampus UJ</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Znajdź salę, budynek, idź na zajęcia
        </h1>
        <p className={`mt-1 text-sm ${sideMutedCls}`}>
          Mapa 3D Krakowa z wszystkimi budynkami UJ. Kliknij na bryłę żeby zobaczyć
          szczegóły, otwórz wnętrza żeby zobaczyć układ pięter i sal.
        </p>
      </div>

      {/* Search */}
      <BaseCard variant="default" className="p-2 md:p-2.5 mb-3">
        <div className="flex items-center gap-2 px-2">
          <Search size={18} strokeWidth={2} className="shrink-0 text-zinc-500" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sala, budynek, wydział…"
            className="flex-1 bg-transparent border-0 outline-none text-base md:text-lg font-medium text-zinc-900 placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500 py-2"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="shrink-0 p-1.5 rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              aria-label="Wyczyść"
            >
              <X size={16} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </BaseCard>

      {/* Geo nudge */}
      {geo.status === 'idle' && (
        <button
          type="button"
          onClick={requestGeo}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1e293b]/25 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#1e293b] backdrop-blur-md transition-colors hover:bg-white/95 dark:border-brand-gold/35 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/55"
        >
          <Crosshair size={14} strokeWidth={2.25} aria-hidden />
          Pokaż dystans do każdej sali
        </button>
      )}
      {geo.status === 'requesting' && (
        <p className={`mb-3 text-xs ${sideMutedCls}`}>Ustalam Twoją lokalizację…</p>
      )}
      {geo.status === 'denied' && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{geo.message}</p>
      )}

      {/* Main layout: list (left) + map (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] gap-4">
        {/* Left column — lista / search */}
        <div className="min-w-0 space-y-3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
          {buildingsError && (
            <BaseCard variant="default" className="p-4 text-sm text-red-600 dark:text-red-400">
              {buildingsError}
            </BaseCard>
          )}

          {buildingsLoading && !buildingsError && (
            <BaseCard variant="default" className="p-4">
              <p className={`text-sm ${sideMutedCls}`}>Ładuję budynki UJ…</p>
            </BaseCard>
          )}

          {showResultsList ? (
            <>
              {searching && (
                <p className={`text-xs ${sideMutedCls}`}>Szukam „{query}"…</p>
              )}
              {showEmptyResults && (
                <BaseCard variant="default" className="p-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Nic nie znalazłem dla „<span className="font-semibold">{query}</span>".
                  </p>
                  <p className={`mt-1 text-xs ${sideMutedCls}`}>
                    Spróbuj innego kodu (np. <span className="font-mono">A-101</span>) albo
                    nazwy budynku.
                  </p>
                </BaseCard>
              )}
              <div className="space-y-2">
                {results.map((hit, idx) => renderSearchResultRow(hit, idx))}
              </div>
            </>
          ) : selectedBuilding ? (
            <BuildingDetailCard
              building={selectedBuilding}
              selectedRoomId={selectedRoomId}
              selectedRoom={selectedRoom}
              rooms={siblingRooms}
              roomsLoading={siblingRoomsLoading}
              userLocation={userLocation}
              exploded={exploded}
              onToggleExploded={toggleExploded}
              onPickRoom={(roomId) => selectRoom(roomId)}
              onClear={clear}
            />
          ) : (
            !buildingsLoading &&
            buildingsByCampus.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Compass size={12} strokeWidth={2.25} className={widgetGoldCls} aria-hidden />
                  <h2 className={sectionTitleCls}>{group.label}</h2>
                  <span className={`text-[10px] ${sideMutedCls}`}>
                    {group.items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.items.map((b) => renderBuildingTile(b))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Right column — mapa 3D */}
        <div className="min-w-0">
          <div
            className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#0a0f2a]"
            style={{ height: 'min(72vh, 720px)' }}
          >
            <MapLibreCanvas
              buildings={buildings}
              selectedBuildingId={selectedBuildingId}
              hoveredBuildingId={hoveredBuildingId}
              onSelectBuilding={selectBuilding}
              onHoverBuilding={setHoveredBuildingId}
            />
            {/* Heads-up display: kierunek "kompasu" przypomnienie */}
            {!selectedBuildingId && !buildingsLoading && (
              <div className="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-xl bg-white/85 px-3 py-2 text-[11px] backdrop-blur-md shadow-sm dark:bg-black/65">
                <p className="font-semibold text-[#1e293b] dark:text-brand-gold-bright">
                  Kliknij budynek żeby zobaczyć szczegóły
                </p>
                <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
                  Przytrzymaj prawy przycisk + myszka żeby obrócić widok.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exploded view modal (lazy) */}
      <AnimatePresence>
        {exploded && selectedBuilding && (
          <motion.div
            key="exploded-modal"
            className="fixed inset-0 z-10050 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              aria-hidden
              onClick={() => setExploded(false)}
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 bg-linear-to-b from-black/70 to-transparent">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-brand-gold-bright font-bold">
                    Wnętrza · układ schematyczny
                  </p>
                  <h2 className="text-lg sm:text-2xl font-extrabold text-white truncate">
                    {selectedBuilding.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setExploded(false)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <X size={14} strokeWidth={2.5} />
                  Zwiń
                </button>
              </div>
              <div className="relative flex-1">
                <Suspense fallback={<ExplodedFallback />}>
                  <ExplodedBuildingView
                    building={selectedBuilding}
                    rooms={siblingRooms}
                    roomsLoading={siblingRoomsLoading}
                    selectedRoomId={selectedRoomId}
                    onPickRoom={(roomId) => selectRoom(roomId)}
                  />
                </Suspense>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────

function ExplodedFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center text-white/85">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-brand-gold-bright" />
        <p className="mt-3 text-sm font-semibold">Ładuję widok 3D wnętrz…</p>
        <p className="mt-1 text-xs text-white/55">~600KB modułu Three.js, jednorazowo na sesję.</p>
      </div>
    </div>
  )
}

type BuildingDetailCardProps = {
  building: Building
  selectedRoomId: string | null
  selectedRoom: Room | null
  rooms: Room[]
  roomsLoading: boolean
  userLocation: { lat: number; lng: number } | null
  exploded: boolean
  onToggleExploded: () => void
  onPickRoom: (roomId: string) => void
  onClear: () => void
}

function BuildingDetailCard({
  building,
  selectedRoomId,
  selectedRoom,
  rooms,
  roomsLoading,
  userLocation,
  exploded,
  onToggleExploded,
  onPickRoom,
  onClear,
}: BuildingDetailCardProps) {
  const directionsHref = googleMapsDirectionsUrl(
    { lat: building.lat, lng: building.lng },
    userLocation,
  )

  // Pogrupuj sale wg piętra dla quick scrolling.
  const roomsByFloor = useMemo(() => {
    const map = new Map<number, Room[]>()
    for (const r of rooms) {
      const level = r.floor ?? 0
      const list = map.get(level) ?? []
      list.push(r)
      map.set(level, list)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, rs]) => ({ level, rooms: rs }))
  }, [rooms])

  return (
    <BaseCard variant="default" className="p-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#1e293b] dark:text-brand-gold-bright">
              Budynek
            </span>
            {building.short_name && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {building.short_name}
              </span>
            )}
          </div>
          <h2 className="text-lg md:text-xl font-extrabold text-zinc-900 dark:text-white">
            {building.name}
          </h2>
          {building.description && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {building.description}
            </p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <MapPin size={14} strokeWidth={2} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
            {building.address}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 p-1.5 rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          aria-label="Zamknij podgląd"
        >
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

      {/* Akcje */}
      <div className="px-4 mt-1 mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleExploded}
          className={`${theme.button.primary} px-3 py-2 text-xs`}
        >
          <Sparkles size={13} strokeWidth={2.25} aria-hidden />
          {exploded ? 'Zwiń wnętrza' : 'Pokaż wnętrza 3D'}
        </button>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#1e293b]/35 bg-white px-3 py-2 text-xs font-semibold text-[#1e293b] hover:bg-[#1e293b]/5 dark:border-brand-gold/45 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/60"
        >
          <ExternalLink size={12} strokeWidth={2.25} aria-hidden />
          Otwórz w Mapach
        </a>
      </div>

      {/* Selected room highlight */}
      {selectedRoom && (
        <div className="mx-4 mb-3 rounded-xl border border-[#1e293b]/30 bg-[#1e293b]/4 px-3 py-2 dark:border-brand-gold/35 dark:bg-brand-gold/6">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#1e293b] dark:text-brand-gold-bright">
              Wybrana sala
            </span>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              Sala {selectedRoom.code}
            </p>
          </div>
          {selectedRoom.display_name && selectedRoom.display_name !== `Sala ${selectedRoom.code}` && (
            <p className="text-xs text-zinc-700 dark:text-zinc-300">{selectedRoom.display_name}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            {selectedRoom.floor !== null && (
              <span className="inline-flex items-center gap-1">
                <Layers size={11} strokeWidth={2} aria-hidden />
                {describeFloor(selectedRoom.floor)}
              </span>
            )}
            {selectedRoom.capacity !== null && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} strokeWidth={2} aria-hidden />
                {selectedRoom.capacity} miejsc
              </span>
            )}
          </div>
          {selectedRoom.notes && (
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{selectedRoom.notes}</p>
          )}
        </div>
      )}

      {/* Sale w budynku */}
      <div className="mx-4 mb-4 pt-3 border-t border-zinc-200 dark:border-white/10">
        <h3 className={`mb-2 ${sectionTitleCls}`}>Sale w tym budynku</h3>
        {roomsLoading && roomsByFloor.length === 0 && (
          <p className={`text-xs ${sideMutedCls}`}>Ładuję sale…</p>
        )}
        {!roomsLoading && roomsByFloor.length === 0 && (
          <p className={`text-xs ${sideMutedCls}`}>Brak sal w bazie dla tego budynku.</p>
        )}
        <div className="space-y-3">
          {roomsByFloor.map((group) => (
            <div key={group.level}>
              <p className={`mb-1 text-[10px] uppercase tracking-wider ${sideMutedCls}`}>
                {describeFloor(group.level) || 'parter'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {group.rooms.map((r) => {
                  const isSelected = selectedRoomId === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onPickRoom(r.id)}
                      className={`text-left rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-[#1e293b]/60 bg-[#1e293b]/8 text-[#1e293b] dark:border-brand-gold/60 dark:bg-brand-gold/12 dark:text-brand-gold-bright'
                          : 'border-zinc-200 bg-white/60 text-zinc-800 hover:border-[#1e293b]/45 hover:bg-white dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:border-brand-gold/55 dark:hover:bg-black/50'
                      }`}
                    >
                      <span className="block truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {r.code}
                      </span>
                      <span className="block truncate">
                        {r.display_name && r.display_name !== `Sala ${r.code}`
                          ? r.display_name
                          : describeFloor(r.floor) || '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  )
}
