import { useEffect, useMemo, useRef } from 'react'
import {
  Building2,
  Compass,
  Crosshair,
  ExternalLink,
  Hash,
  Layers,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useSaleFinder } from '../../hooks/useSaleFinder'
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

/**
 * SaleFinderView — slim wyszukiwarka sal i budynków UJ.
 *
 * Następca `Campus3DView` (mapa MapLibre + exploded floors z `@react-three/fiber`).
 * Tamten widok był UI theatre: footprinty OSM + sale layoutowane proceduralnie
 * w bbox-ie budynku — bo realnych planów UJ nie mamy i mieć nie będziemy.
 * 4 boxy w 8000 m² obrysie nie pomagały studentowi znaleźć sali; pomagał
 * kod sali (A-1-04 = skrzydło A, parter, sala 4) i strzałka na ścianie.
 *
 * Zostaje to co naprawdę przydaje się przed wyjściem na zajęcia:
 *  1. Search po kodzie sali / nazwie budynku / aliasie wydziału.
 *  2. Geo opt-in → dystans + minuty pieszo do każdego wyniku.
 *  3. Detal budynku: adres + Google Maps walking link + lista sal po piętrach.
 *
 * Brak `useCampus3D` (URL-state sync, exploded toggle) — selekcja jest
 * efemeryczna (lokalny `useSaleFinder.selected`), bo deep-linki do
 * konkretnej sali zostały zastąpione przez globalny `/search` (action label
 * "Otwórz w mapie" w wynikach SearchPageView prowadzi z powrotem tutaj).
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
    geo,
    userLocation,
    requestGeo,
    distanceKmTo,
  } = useSaleFinder()

  const inputRef = useRef<HTMLInputElement | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  // Autofocus tylko na desktopie — na mobile nie chcemy od razu wyciągać klawiatury.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      inputRef.current?.focus()
    }
  }, [])

  // ESC: zwija selekcję (search-bar ma own clear przez X).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) clearSelection()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, clearSelection])

  // Mobile auto-scroll do detalu po wyborze — bez tego user nie widzi że coś się zmieniło.
  useEffect(() => {
    if (!selected) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    const handle = window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(handle)
  }, [selected])

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

  const selectedRoomId =
    selected?.kind === 'room' ? selected.room.id : null

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderSearchHit = (hit: SearchResult, idx: number) => {
    const isSelected =
      hit.kind === 'building'
        ? selected?.kind === 'building' && selected.building.id === hit.building.id
        : selected?.kind === 'room' && selected.room.id === hit.room.id

    const dist = distanceKmTo(hit.building)

    if (hit.kind === 'building') {
      return (
        <BaseCard
          key={`b:${hit.building.id}:${idx}`}
          variant="inner"
          interactive
          as="button"
          onClick={() => select({ kind: 'building', building: hit.building })}
          className={`w-full text-left p-3 flex items-start gap-2.5 ${
            isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
          }`}
        >
          <Building2
            size={16}
            strokeWidth={2}
            className={`mt-0.5 shrink-0 ${widgetGoldCls}`}
            aria-hidden
          />
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

    return (
      <BaseCard
        key={`r:${hit.room.id}:${idx}`}
        variant="inner"
        interactive
        as="button"
        onClick={() =>
          select({ kind: 'room', room: hit.room, building: hit.building })
        }
        className={`w-full text-left p-3 flex items-start gap-2.5 ${
          isSelected ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <Hash
          size={16}
          strokeWidth={2}
          className={`mt-0.5 shrink-0 ${widgetGoldCls}`}
          aria-hidden
        />
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
    const isSel = selected?.kind === 'building' && selected.building.id === building.id
    const dist = distanceKmTo(building)
    return (
      <BaseCard
        key={building.id}
        variant="inner"
        interactive
        as="button"
        onClick={() => select({ kind: 'building', building })}
        className={`w-full text-left p-3 flex items-start gap-2.5 ${
          isSel ? 'border-[#1e293b]/45 dark:border-brand-gold/55' : ''
        }`}
      >
        <Building2
          size={16}
          strokeWidth={2}
          className={`mt-0.5 shrink-0 ${widgetGoldCls}`}
          aria-hidden
        />
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

  // ── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-3 md:mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <MapPin size={14} strokeWidth={2} className={widgetGoldCls} aria-hidden />
          <span className={sectionTitleCls}>Sale UJ · Wyszukiwarka</span>
        </div>
        <h1 className="text-xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Znajdź salę albo budynek
        </h1>
        <p className={`mt-1 hidden md:block text-sm ${sideMutedCls}`}>
          Wpisz kod sali (np. <span className="font-mono">A-101</span>) albo nazwę budynku.
          Pokażemy adres, dystans i nawigację w Mapach Google.
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
              className="shrink-0 p-2 rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              aria-label="Wyczyść"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </BaseCard>

      {/* Geo nudge */}
      {geo.status === 'idle' && (
        <button
          type="button"
          onClick={requestGeo}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1e293b]/25 bg-white/70 px-3 py-2 text-xs font-semibold text-[#1e293b] backdrop-blur-md transition-colors hover:bg-white/95 dark:border-brand-gold/35 dark:bg-black/40 dark:text-brand-gold-bright dark:hover:bg-black/55"
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

      {/* Treść główna — search results | detail | building list */}
      <div ref={detailRef} className="space-y-3 scroll-mt-4">
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
              {results.map((hit, idx) => renderSearchHit(hit, idx))}
            </div>
          </>
        ) : selected ? (
          <BuildingDetailCard
            building={selected.building}
            selectedRoomId={selectedRoomId}
            rooms={siblingRooms}
            roomsLoading={siblingRoomsLoading}
            userLocation={userLocation}
            distanceKm={distanceKmTo(selected.building)}
            onPickRoom={(roomId) => {
              const room = siblingRooms.find((r) => r.id === roomId)
              if (room) select({ kind: 'room', room, building: selected.building })
            }}
            onClear={clearSelection}
          />
        ) : (
          !buildingsLoading &&
          buildingsByCampus.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Compass
                  size={12}
                  strokeWidth={2.25}
                  className={widgetGoldCls}
                  aria-hidden
                />
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Detail card
// ─────────────────────────────────────────────────────────────────────────

type BuildingDetailCardProps = {
  building: Building
  selectedRoomId: string | null
  rooms: Room[]
  roomsLoading: boolean
  userLocation: { lat: number; lng: number } | null
  distanceKm: number | null
  onPickRoom: (roomId: string) => void
  onClear: () => void
}

function BuildingDetailCard({
  building,
  selectedRoomId,
  rooms,
  roomsLoading,
  userLocation,
  distanceKm,
  onPickRoom,
  onClear,
}: BuildingDetailCardProps) {
  const directionsHref = googleMapsDirectionsUrl(
    { lat: building.lat, lng: building.lng },
    userLocation,
  )

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

  const selectedRoom = useMemo(
    () =>
      selectedRoomId
        ? rooms.find((r) => r.id === selectedRoomId) ?? null
        : null,
    [selectedRoomId, rooms],
  )

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
          <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <MapPin
              size={14}
              strokeWidth={2}
              className="shrink-0 mt-0.5 text-[#1e293b] dark:text-brand-gold-bright"
              aria-hidden
            />
            <span className="wrap-break-word">{building.address}</span>
          </p>
          {distanceKm !== null && (
            <p className="mt-1 text-xs font-medium text-[#1e293b] dark:text-brand-gold-bright">
              {formatDistance(distanceKm)} · ~{walkingMinutes(distanceKm)} min pieszo
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 p-2 rounded-full text-zinc-500 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          aria-label="Zamknij podgląd"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      </div>

      {/* CTA — pełnoszerokościowy walking-directions link */}
      <div className="px-4 mb-3">
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${theme.button.primary} w-full justify-center px-4 py-2.5 text-xs`}
        >
          <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
          Otwórz nawigację w Mapach Google
        </a>
      </div>

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
          {selectedRoom.display_name &&
            selectedRoom.display_name !== `Sala ${selectedRoom.code}` && (
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {selectedRoom.display_name}
              </p>
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
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              {selectedRoom.notes}
            </p>
          )}
        </div>
      )}

      <div className="mx-4 mb-4 pt-3 border-t border-zinc-200 dark:border-white/10">
        <h3 className={`mb-2 ${sectionTitleCls}`}>Sale w tym budynku</h3>
        {roomsLoading && roomsByFloor.length === 0 && (
          <p className={`text-xs ${sideMutedCls}`}>Ładuję sale…</p>
        )}
        {!roomsLoading && roomsByFloor.length === 0 && (
          <p className={`text-xs ${sideMutedCls}`}>
            Brak sal w bazie dla tego budynku.
          </p>
        )}
        <div className="space-y-3">
          {roomsByFloor.map((group) => (
            <div key={group.level}>
              <p
                className={`mb-1 text-[10px] uppercase tracking-wider ${sideMutedCls}`}
              >
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
