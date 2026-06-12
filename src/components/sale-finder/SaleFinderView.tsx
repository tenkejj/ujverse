import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Building2,
  Compass,
  Crosshair,
  ExternalLink,
  Hash,
  Layers,
  Map as MapIcon,
  MapPin,
  Mountain,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react'
import L from 'leaflet'
import { ImageOverlay, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { useSaleFinder } from '../../hooks/useSaleFinder'
import {
  formatDistance,
  googleMapsDirectionsUrl,
  haversineKm,
  pinToLatLng,
  walkingMinutes,
  type Building,
  type FloorPlan,
  type Room,
  type SearchResult,
} from '../../services/SaleFinderService'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import { sectionTitleCls, sideMutedCls, widgetGoldCls } from '../../lib/sidePanelStyles'

/**
 * SaleFinderView — wyszukiwarka sal i budynków UJ.
 *
 * Layout:
 *   - Mobile: jednokolumnowy widok. Po wybraniu budynku/sali — pełnoekranowy
 *     sheet z mapą i akcjami (analogicznie do EventModal).
 *   - Desktop (≥lg): split — lista po lewej, panel detail (mapa + akcje) po
 *     prawej. Selected target jest też podświetlony na liście.
 *
 * Nawigacja po wynikach klawiaturą (↑/↓/Enter) jest opóźniona do v2 — w v1
 * fokus pozostaje na inpucie a click na karcie wybiera target.
 */

const CAMPUS_LABELS: Record<string, string> = {
  '600-lecia': 'Kampus 600-lecia',
  srodmiescie: 'Śródmieście',
  medyczny: 'Collegium Medicum',
}

const CAMPUS_ORDER: ReadonlyArray<string> = ['600-lecia', 'srodmiescie', 'medyczny']

const PIN_ICON = L.divIcon({
  className: 'sale-finder-pin',
  html: `<div aria-hidden="true" style="width:32px;height:36px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))">
    <svg width="28" height="36" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path fill="#1e293b" stroke="#fff" stroke-width="1.25" d="M12 2C7.5 2 4 5.4 4 9.7c0 5.2 4.2 9.5 8 14.3 3.8-4.8 8-9.1 8-14.3C20 5.4 16.5 2 12 2z"/>
      <circle cx="12" cy="9.5" r="3.2" fill="#fff"/>
    </svg>
  </div>`,
  iconSize: [32, 36],
  iconAnchor: [16, 34],
})

const USER_ICON = L.divIcon({
  className: 'sale-finder-user',
  html: `<div aria-hidden="true" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 2px rgba(59,130,246,.35);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

/**
 * Pulsujący czerwony pin dla "TWOJA SALA" na rzucie piętra. Wyróżnia się
 * od navy budynku, żeby user na pierwszy rzut oka widział gdzie idzie.
 */
const ROOM_PIN_ICON = L.divIcon({
  className: 'sale-finder-room-pin',
  html: `<div aria-hidden="true" style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
    <span style="position:absolute;width:36px;height:36px;border-radius:9999px;background:rgba(220,38,38,.25);animation:saleRoomPulse 1.6s ease-out infinite;"></span>
    <span style="position:relative;width:18px;height:18px;border-radius:9999px;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);"></span>
  </div>
  <style>@keyframes saleRoomPulse{0%{transform:scale(.6);opacity:.85}100%{transform:scale(1.4);opacity:0}}</style>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

/** Bounds w formacie Leaflet [[N,W],[S,E]] z planu piętra. */
function planLeafletBounds(
  plan: FloorPlan,
): [[number, number], [number, number]] {
  return [
    [plan.bounds_south, plan.bounds_west],
    [plan.bounds_north, plan.bounds_east],
  ]
}

/**
 * `<MapZoomController>` — kiedy zmienia się aktywny plan piętra,
 * dopasowuje viewport mapy do bounds tego planu, żeby user widział
 * cały rzut bez przewijania. Bez planu — zoom 17 na centroid budynku.
 */
function MapZoomController({
  plan,
  buildingCenter,
}: {
  plan: FloorPlan | null
  buildingCenter: [number, number]
}) {
  const map = useMap()
  // Rozbicie tablicy na primitive deps — inline `[lat,lng]` to nowa
  // referencja per render, co bez tego triggerowałoby effect kazdym razem.
  const [centerLat, centerLng] = buildingCenter
  useEffect(() => {
    try {
      if (plan) {
        const bounds = planLeafletBounds(plan)
        // planLeafletBounds zwraca [[s,w],[n,e]] — sprawdzamy czy wszystko
        // skończone, inaczej pomijamy fly (lepszy stały widok niż wybuch).
        const allFinite = bounds.every(([a, b]) =>
          Number.isFinite(a) && Number.isFinite(b),
        )
        if (allFinite) {
          map.flyToBounds(bounds, {
            padding: [16, 16],
            duration: 0.4,
            maxZoom: 21,
          })
        }
      } else if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        map.flyTo([centerLat, centerLng], 17, { duration: 0.4 })
      }
    } catch (err) {
      // Defensywa — Leaflet rzuca przy degenerated bounds (north === south).
      // Nie krytyczne; po prostu nie ruszamy widoku.
      console.warn('[SaleFinder] MapZoomController fly failed:', err)
    }
  }, [plan, centerLat, centerLng, map])
  return null
}

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

export default function SaleFinderView(_props: Props) {
  const {
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
  } = useSaleFinder()

  const inputRef = useRef<HTMLInputElement | null>(null)

  // Auto-fokus na input przy wejściu — utility view, user przyszedł tu
  // konkretnie żeby coś wyszukać.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Lista do pokazania (puste query → wszystkie budynki, query → wyniki) ─
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

  const handlePickBuilding = (building: Building) => {
    select({ kind: 'building', building })
  }

  const handlePickRoom = (room: Room, building: Building) => {
    select({ kind: 'room', room, building })
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDERY (sub-render functions, składamy je w return na dole)
  // ─────────────────────────────────────────────────────────────────

  const renderSearchResultRow = (hit: SearchResult, idx: number) => {
    const isSelected =
      (selected?.kind === 'building' &&
        hit.kind === 'building' &&
        selected.building.id === hit.building.id) ||
      (selected?.kind === 'room' &&
        hit.kind === 'room' &&
        selected.room.id === hit.room.id)

    if (hit.kind === 'building') {
      const dist = distanceKmTo(hit.building)
      return (
        <BaseCard
          key={`b:${hit.building.id}:${idx}`}
          variant="inner"
          interactive
          as="button"
          onClick={() => handlePickBuilding(hit.building)}
          className={`w-full text-left p-4 flex items-start gap-3 ${
            isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
          }`}
        >
          <div className="shrink-0 mt-0.5">
            <Building2 size={18} strokeWidth={2} className={widgetGoldCls} aria-hidden />
          </div>
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
        onClick={() => handlePickRoom(hit.room, hit.building)}
        className={`w-full text-left p-4 flex items-start gap-3 ${
          isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <div className="shrink-0 mt-0.5">
          <Hash size={18} strokeWidth={2} className={widgetGoldCls} aria-hidden />
        </div>
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
    const isSelected = selected?.kind === 'building' && selected.building.id === building.id
    const dist = distanceKmTo(building)
    return (
      <BaseCard
        key={building.id}
        variant="inner"
        interactive
        as="button"
        onClick={() => handlePickBuilding(building)}
        className={`w-full text-left p-4 flex items-start gap-3 ${
          isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <div className="shrink-0 mt-0.5">
          <Building2 size={18} strokeWidth={2} className={widgetGoldCls} aria-hidden />
        </div>
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

  // ─────────────────────────────────────────────────────────────────
  // Detail panel
  // ─────────────────────────────────────────────────────────────────

  const detailPanel = selected ? (
    <SaleDetailPanel
      target={selected}
      siblingRooms={siblingRooms}
      siblingRoomsLoading={siblingRoomsLoading}
      floorPlans={floorPlans}
      floorPlansLoading={floorPlansLoading}
      activeLevel={activeLevel}
      activePlan={activePlan}
      onChangeLevel={setActiveLevel}
      userLocation={userLocation}
      onClose={clearSelection}
      onPickRoom={(room) => handlePickRoom(room, selected.building)}
      onPickBuilding={() => {
        if (selected.kind === 'room') handlePickBuilding(selected.building)
      }}
    />
  ) : null

  const showResultsList = query.trim().length > 0
  const showEmptyResults =
    showResultsList && !searching && results.length === 0 && !buildingsLoading

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Hero / search bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <MapPin size={14} strokeWidth={2} className={widgetGoldCls} aria-hidden />
          <span className={sectionTitleCls}>Sale UJ</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Znajdź salę albo budynek
        </h1>
        <p className={`mt-1 text-sm ${sideMutedCls}`}>
          Wpisz kod sali (np. <span className="font-mono">0010</span>), nazwę budynku
          (<em>Łojasiewicza</em>, <em>Maius</em>) albo skrót wydziału (<em>WMI</em>, <em>WPiA</em>).
        </p>
      </div>

      <BaseCard variant="default" className="p-2 md:p-2.5 mb-4">
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
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1e293b]/25 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#1e293b] backdrop-blur-md transition-colors hover:bg-white/95 dark:border-brand-gold/35 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/55"
        >
          <Crosshair size={14} strokeWidth={2.25} aria-hidden />
          Pokaż dystans do każdej sali
        </button>
      )}
      {geo.status === 'requesting' && (
        <p className={`mb-4 text-xs ${sideMutedCls}`}>Ustalam Twoją lokalizację…</p>
      )}
      {geo.status === 'denied' && (
        <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">{geo.message}</p>
      )}

      {/* Layout split: list (left) + detail (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4">
        <div className="min-w-0 space-y-3">
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

        {/* Desktop detail panel — sticky on the right */}
        <aside className="hidden lg:block min-w-0">
          <div className="sticky top-20">
            {detailPanel ?? (
              <BaseCard variant="default" className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} strokeWidth={2} className={widgetGoldCls} aria-hidden />
                  <span className={sectionTitleCls}>Podgląd</span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Wybierz salę lub budynek z listy żeby zobaczyć go na mapie.
                </p>
                <p className={`mt-2 text-xs ${sideMutedCls}`}>
                  Działa też z lokalizacją — kliknij „Pokaż dystans" wyżej żeby zobaczyć ile
                  minut piechotą do każdej sali.
                </p>
              </BaseCard>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile detail sheet */}
      <AnimatePresence>
        {detailPanel && (
          <motion.div
            key="sale-mobile-sheet"
            className="fixed inset-0 z-10040 lg:hidden flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="flex-1 bg-black/55 backdrop-blur-[2px]"
              aria-hidden
              onClick={clearSelection}
            />
            <motion.div
              className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-white px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-12px_40px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_-16px_48px_rgba(0,0,0,0.5)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="mx-auto mb-2 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              {detailPanel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Detail panel (subkomponent w tym samym pliku — used by both desktop
// sticky right panel i mobile sheet)
// ───────────────────────────────────────────────────────────────────

type DetailTarget =
  | { kind: 'building'; building: Building }
  | { kind: 'room'; room: Room; building: Building }

type DetailProps = {
  target: DetailTarget
  siblingRooms: Room[]
  siblingRoomsLoading: boolean
  floorPlans: FloorPlan[]
  floorPlansLoading: boolean
  activeLevel: number | null
  activePlan: FloorPlan | null
  onChangeLevel: (level: number) => void
  userLocation: { lat: number; lng: number } | null
  onClose: () => void
  onPickRoom: (room: Room) => void
  onPickBuilding: () => void
}

type TileStyle = 'satellite' | 'street'

const ESRI_SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const ESRI_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

const OSM_STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

function SaleDetailPanel({
  target,
  siblingRooms,
  siblingRoomsLoading,
  floorPlans,
  floorPlansLoading,
  activeLevel,
  activePlan,
  onChangeLevel,
  userLocation,
  onClose,
  onPickRoom,
  onPickBuilding,
}: DetailProps) {
  const building = target.building
  const room = target.kind === 'room' ? target.room : null

  // Tile style — domyślnie satelita Esri (po feedbacku że zwykły OSM
  // pokazuje tylko ulice, nie sam budynek). Toggle przeniesiony do
  // user state, żeby preferencja przeżyła zmianę selekcji.
  const [tileStyle, setTileStyle] = useState<TileStyle>('satellite')

  const mapKey = `${building.id}:${room?.id ?? 'main'}`

  // Walidacja koordynat budynku. Jeśli z DB przyszły wyzerowane / NaN
  // współrzędne (źle zapuszczona migracja, ręczny INSERT bez lat/lng),
  // pokazujemy graceful error card zamiast wybuchu Leaflet.
  const buildingCenter = useMemo<[number, number] | null>(() => {
    if (
      !Number.isFinite(building.lat) ||
      !Number.isFinite(building.lng) ||
      // 0,0 fallback z normalizeBuilding — gołębie centrum oceanu, nie UJ.
      (building.lat === 0 && building.lng === 0)
    ) {
      return null
    }
    return [building.lat, building.lng]
  }, [building.lat, building.lng])

  // Pin sali na planie — gdy mamy sale + plan + procenty: render w
  // konkretnym punkcie. Inaczej fallback na centroid budynku
  // (dla wybranego budynku bez sali, lub sali bez pin_x/y).
  const roomPinPosition: [number, number] | null = useMemo(() => {
    if (!room) return null
    if (room.pin_x_pct === null || room.pin_y_pct === null) return null
    if (!activePlan) return null
    if (room.floor !== null && room.floor !== activePlan.level) return null
    const ll = pinToLatLng(activePlan, room.pin_x_pct, room.pin_y_pct)
    if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return null
    return [ll.lat, ll.lng]
  }, [room, activePlan])

  const distanceKm =
    userLocation && buildingCenter
      ? haversineKm(userLocation, { lat: buildingCenter[0], lng: buildingCenter[1] })
      : null

  const directionsHref = buildingCenter
    ? googleMapsDirectionsUrl(
        { lat: buildingCenter[0], lng: buildingCenter[1] },
        userLocation ?? null,
      )
    : null

  const otherRooms = useMemo(() => {
    return room
      ? siblingRooms.filter((r) => r.id !== room.id)
      : siblingRooms
  }, [room, siblingRooms])

  return (
    <BaseCard variant="default" className="p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          {room ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#1e293b] dark:text-brand-gold-bright">
                  Sala
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-zinc-900 dark:text-white">
                  {room.code}
                </h2>
              </div>
              {room.display_name && room.display_name !== `Sala ${room.code}` && (
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {room.display_name}
                </p>
              )}
              <button
                type="button"
                onClick={onPickBuilding}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#1e293b] hover:underline dark:text-brand-gold-bright"
              >
                <Building2 size={12} strokeWidth={2.25} aria-hidden />
                {building.name}
              </button>
            </>
          ) : (
            <>
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
              <h2 className="text-xl md:text-2xl font-extrabold text-zinc-900 dark:text-white">
                {building.name}
              </h2>
              {building.description && (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {building.description}
                </p>
              )}
            </>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <MapPin size={14} strokeWidth={2} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
            {building.address}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          aria-label="Zamknij podgląd"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      </div>

      {/* Floor selector — pokazujemy tylko gdy są dostępne plany */}
      {floorPlans.length > 0 && (
        <FloorLevelPills
          plans={floorPlans}
          activeLevel={activeLevel}
          onChange={onChangeLevel}
          highlightLevel={room?.floor ?? null}
        />
      )}

      {/* Map */}
      <div className="px-4">
        <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#0a0f2a]">
          {buildingCenter ? (
            <MapContainer
              key={mapKey}
              center={buildingCenter}
              zoom={17}
              scrollWheelZoom
              zoomControl={false}
              className="h-[320px] w-full z-0"
              // Wyższy maxZoom niż domyślny, bo Esri World Imagery wspiera
              // do z=21 a plany piętra wymagają z>=19 żeby wypełniły viewport.
              maxZoom={21}
            >
              {tileStyle === 'satellite' ? (
                <>
                  <TileLayer
                    attribution='&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                    url={ESRI_SATELLITE_URL}
                    maxNativeZoom={19}
                    maxZoom={21}
                  />
                  {/* Hybryda: nazwy ulic / dzielnic na satelicie. */}
                  <TileLayer
                    attribution='&copy; Esri'
                    url={ESRI_LABELS_URL}
                    maxNativeZoom={13}
                    maxZoom={21}
                    opacity={0.85}
                  />
                </>
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url={OSM_STREET_URL}
                  maxNativeZoom={19}
                  maxZoom={21}
                />
              )}

              {/* Plan piętra — overlay obrazka w bounds. Renderujemy DOPIERO
                  gdy mamy aktywny plan; brak planu = tylko tile + szpilka. */}
              {activePlan && (
                <ImageOverlay
                  key={`plan:${activePlan.id}`}
                  url={activePlan.image_url}
                  bounds={planLeafletBounds(activePlan)}
                  opacity={0.92}
                  zIndex={400}
                />
              )}

              {/* Pin budynku — pokazujemy gdy NIE mamy planu albo gdy mamy
                  wybraną salę bez pin_x/y (żeby coś było widać). */}
              {!activePlan && (
                <Marker position={buildingCenter} icon={PIN_ICON} />
              )}

              {/* Pin sali — czerwony pulsujący marker. Pojawia się tylko
                  gdy mamy plan na właściwym poziomie + procenty. */}
              {roomPinPosition && (
                <Marker position={roomPinPosition} icon={ROOM_PIN_ICON} />
              )}

              {userLocation &&
                Number.isFinite(userLocation.lat) &&
                Number.isFinite(userLocation.lng) && (
                  <Marker
                    position={[userLocation.lat, userLocation.lng]}
                    icon={USER_ICON}
                  />
                )}

              <MapZoomController
                plan={activePlan}
                buildingCenter={buildingCenter}
              />
            </MapContainer>
          ) : (
            <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
              <MapPin size={22} strokeWidth={2} className="text-[#1e293b]/60 dark:text-brand-gold/60" aria-hidden />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Brak współrzędnych dla tego budynku
              </p>
              <p>
                Sprawdź czy migracja{' '}
                <code className="font-mono text-[11px]">
                  20260616100000_uj_buildings_rooms.sql
                </code>{' '}
                została zaaplikowana w Supabase.
              </p>
            </div>
          )}

          {/* Tile style toggle — overlay floating w prawym górnym rogu mapy */}
          <div className="absolute top-2 right-2 z-401 flex rounded-lg overflow-hidden border border-white/40 shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={() => setTileStyle('satellite')}
              aria-pressed={tileStyle === 'satellite'}
              className={`px-2.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                tileStyle === 'satellite'
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold dark:text-black'
                  : 'bg-white/85 text-[#1e293b] hover:bg-white dark:bg-black/55 dark:text-white dark:hover:bg-black/75'
              }`}
            >
              <Mountain size={12} strokeWidth={2.25} aria-hidden />
              Satelita
            </button>
            <button
              type="button"
              onClick={() => setTileStyle('street')}
              aria-pressed={tileStyle === 'street'}
              className={`px-2.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                tileStyle === 'street'
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold dark:text-black'
                  : 'bg-white/85 text-[#1e293b] hover:bg-white dark:bg-black/55 dark:text-white dark:hover:bg-black/75'
              }`}
            >
              <MapIcon size={12} strokeWidth={2.25} aria-hidden />
              Mapa
            </button>
          </div>
        </div>

        {/* Stan planów — jasny komunikat zamiast cichego brak-planu */}
        {!floorPlansLoading && floorPlans.length === 0 && (
          <FloorPlanMissingHint buildingName={building.name} />
        )}
      </div>

      {/* Stats row */}
      <div className="px-4 mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-700 dark:text-zinc-300">
        {room?.floor !== null && room?.floor !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <Layers size={12} strokeWidth={2.25} className="text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
            {describeFloor(room.floor)}
          </span>
        )}
        {room?.capacity !== null && room?.capacity !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <Users size={12} strokeWidth={2.25} className="text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
            {room.capacity} miejsc
          </span>
        )}
        {distanceKm !== null && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1e293b] dark:text-brand-gold-bright">
            <Crosshair size={12} strokeWidth={2.25} aria-hidden />
            {formatDistance(distanceKm)} · ~{walkingMinutes(distanceKm)} min pieszo
          </span>
        )}
      </div>

      {room?.notes && (
        <p className="mx-4 mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-white/10 dark:bg-black/30 dark:text-zinc-300">
          {room.notes}
        </p>
      )}

      {/* CTA — chowamy gdy nie znamy współrzędnych (sensownego linku
          do map nie wygenerujemy). */}
      {directionsHref && (
        <div className="px-4 mt-4 flex flex-wrap gap-2">
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${theme.button.primary} px-4 py-2.5 text-sm`}
          >
            <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
            Otwórz w Mapach
          </a>
        </div>
      )}

      {/* Pozostałe sale w budynku */}
      {(otherRooms.length > 0 || siblingRoomsLoading) && (
        <div className="mx-4 mt-4 mb-4 pt-3 border-t border-zinc-200 dark:border-white/10">
          <h3 className={`mb-2 ${sectionTitleCls}`}>
            {room ? 'Inne sale w tym budynku' : 'Sale w tym budynku'}
          </h3>
          {siblingRoomsLoading && otherRooms.length === 0 ? (
            <p className={`text-xs ${sideMutedCls}`}>Ładuję sale…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {otherRooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPickRoom(r)}
                  className="text-left rounded-lg border border-zinc-200 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:border-[#1e293b]/45 hover:bg-white dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:border-brand-gold/55 dark:hover:bg-black/50 transition-colors"
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
              ))}
            </div>
          )}
        </div>
      )}
    </BaseCard>
  )
}

// ───────────────────────────────────────────────────────────────────
// Pomocnicze: pigułki wyboru piętra + placeholder "brak planu"
// ───────────────────────────────────────────────────────────────────

function levelLabel(level: number, displayName: string | null): string {
  if (displayName) return displayName
  if (level === 0) return 'Parter'
  if (level === 1) return '1. piętro'
  if (level > 0) return `${level}. piętro`
  return `Piwnica ${level}`
}

type FloorLevelPillsProps = {
  plans: FloorPlan[]
  activeLevel: number | null
  highlightLevel: number | null
  onChange: (level: number) => void
}

/**
 * Pigułki wyboru piętra. Plany są już posortowane wg `level` rosnąco
 * w hooku, więc tutaj tylko mapujemy. Sala wybrana przez usera
 * (`highlightLevel`) dostaje akcent — sygnał "tu jest twoja sala".
 */
function FloorLevelPills({
  plans,
  activeLevel,
  highlightLevel,
  onChange,
}: FloorLevelPillsProps) {
  if (plans.length === 0) return null
  return (
    <div className="px-4 mt-3 flex items-center gap-2">
      <Layers
        size={12}
        strokeWidth={2.25}
        className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright"
        aria-hidden
      />
      <div className="flex-1 flex flex-wrap gap-1.5">
        {plans.map((plan) => {
          const isActive = plan.level === activeLevel
          const isUserRoom = plan.level === highlightLevel
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange(plan.level)}
              aria-pressed={isActive}
              className={`relative px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold dark:text-black'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:border-[#1e293b]/45 dark:border-white/10 dark:bg-black/30 dark:text-zinc-200 dark:hover:border-brand-gold/45'
              }`}
            >
              {levelLabel(plan.level, plan.display_name)}
              {isUserRoom && !isActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500"
                  aria-label="Twoja sala jest na tym piętrze"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type FloorPlanMissingHintProps = {
  buildingName: string
}

/**
 * Placeholder "Plan piętra w przygotowaniu". CTA do crowdsourcingu —
 * `mailto` z prefilowanym adresem (admin contact) zamiast UI flow,
 * dopóki nie mamy table'i `floor_plan_submissions` z proper review
 * pipeline. Lekkie, ale pokazuje że feature jest świadomie niekompletny
 * a nie zepsuty.
 */
function FloorPlanMissingHint({ buildingName }: FloorPlanMissingHintProps) {
  const subject = encodeURIComponent(`UJverse — plan piętra: ${buildingName}`)
  const body = encodeURIComponent(
    `Cześć,\n\nMam plan piętra dla budynku "${buildingName}".\nW załączniku PNG/PDF.\n\nDzięki!`,
  )
  return (
    <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-3 dark:border-white/15 dark:bg-black/30">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-[#1e293b]/8 text-[#1e293b] dark:bg-brand-gold/15 dark:text-brand-gold-bright">
          <MapPin size={14} strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-900 dark:text-white">
            Plan piętra w przygotowaniu
          </p>
          <p className={`mt-0.5 text-xs ${sideMutedCls}`}>
            UJ nie publikuje rzutu pięter dla tego budynku. Masz go w PDF / na zdjęciu?
            Wyślij — dorzucimy do bazy i każdy student z Twojego wydziału na tym
            zyska.
          </p>
          <a
            href={`mailto:franciszek.dranka@student.uj.edu.pl?subject=${subject}&body=${body}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1e293b]/35 bg-white px-3 py-1 text-[11px] font-semibold text-[#1e293b] hover:bg-[#1e293b]/5 dark:border-brand-gold/45 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/60"
          >
            <Upload size={11} strokeWidth={2.25} aria-hidden />
            Wgraj plan piętra
          </a>
        </div>
      </div>
    </div>
  )
}
