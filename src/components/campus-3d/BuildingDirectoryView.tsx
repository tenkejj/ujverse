import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accessibility,
  Box,
  Building2,
  ChevronLeft,
  ExternalLink,
  Layers,
  MapPin,
  Mic,
  Microscope,
  Search,
  Users,
  X,
} from 'lucide-react'
import { detectKind } from '../../services/Campus3DService'
import {
  formatDistance,
  googleMapsDirectionsUrl,
  walkingMinutes,
  type Building,
  type Room,
} from '../../services/SaleFinderService'

// 3D nadal lazy — opcjonalna "ciekawostka", nie default UX.
const ExplodedBuildingView = lazy(() => import('./ExplodedBuildingView'))

/**
 * BuildingDirectoryView — directory listing sal w budynku.
 *
 * Replace dla wcześniejszego fake "floor plan 2D" — który okazał się
 * UI theater bo:
 *   - Mamy ~5-15 sal/budynek w DB, UJ buildings mają setki sal
 *   - Bez realnych planów UJ wizualizacja 4 kropek w 8000m² obrysie
 *     jest bezużyteczna
 *   - Studenci nawigują po kodzie sali (A-1-04 = skrzydło A, parter,
 *     sala 4) i strzałkach na ścianach, nie po planach
 *
 * Co tu naprawdę pomaga:
 *   1. Banner z nazwą + adresem + dystansem + Google Maps link
 *   2. Search bar do filtrowania sal w tym budynku (np. "aula", "A-1")
 *   3. Floor tabs ze licznikami (Parter, 1.p., 2.p. + "Wszystkie")
 *   4. Grid kart sal z: kodem (duży, mono), nazwą, capacity, kind icon
 *   5. Klik karta → mark selected (highlight + onPickRoom)
 *   6. Bottom: opcjonalny "Widok 3D" jako curiosity link (rzadko user'owi
 *      potrzebny ale fajna estetyka, lazy load)
 *
 * Wszystko keyboard-friendly, mobile-friendly, no WebGL needed.
 */

type Props = {
  building: Building
  rooms: Room[]
  roomsLoading: boolean
  selectedRoomId: string | null
  onPickRoom: (roomId: string) => void
  userLocation: { lat: number; lng: number } | null
  distanceKm: number | null
  /** Callback do zamknięcia całego modal'a (X w prawym górnym rogu). */
  onClose: () => void
}

type ViewMode = 'directory' | '3d'

const KIND_META = {
  aula: { icon: Mic, label: 'Aula' },
  lab: { icon: Microscope, label: 'Laboratorium' },
  standard: { icon: Users, label: 'Sala' },
} as const

export default function BuildingDirectoryView({
  building,
  rooms,
  roomsLoading,
  selectedRoomId,
  onPickRoom,
  userLocation,
  distanceKm,
  onClose,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('directory')
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedRoomRef = useRef<HTMLButtonElement | null>(null)

  // ── Wyliczenia: floor list + filter ──────────────────────────────
  const floorList = useMemo(() => {
    const set = new Set<number>()
    for (const r of rooms) {
      set.add(r.floor ?? 0)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [rooms])

  // Default tab: lowest floor with rooms (parter zwykle), albo "all" gdy
  // tylko jeden floor.
  useEffect(() => {
    if (floorList.length === 1) setActiveFloor('all')
  }, [floorList.length])

  const q = deferredQuery.trim().toLowerCase()

  const filteredRooms = useMemo(() => {
    let out = rooms
    if (activeFloor !== 'all') {
      out = out.filter((r) => (r.floor ?? 0) === activeFloor)
    }
    if (q) {
      out = out.filter((r) => {
        const code = r.code.toLowerCase()
        const name = (r.display_name ?? '').toLowerCase()
        return code.includes(q) || name.includes(q)
      })
    }
    return out
  }, [rooms, activeFloor, q])

  // Counts per floor (włącznie z "Wszystkie" dla policzenia kontekstu).
  const countByFloor = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of rooms) {
      const lv = r.floor ?? 0
      m.set(lv, (m.get(lv) ?? 0) + 1)
    }
    return m
  }, [rooms])

  // Auto-przełącz na piętro wybranej sali (gdy klikasz z search).
  useEffect(() => {
    if (!selectedRoomId) return
    const room = rooms.find((r) => r.id === selectedRoomId)
    if (room) {
      const lv = room.floor ?? 0
      if (activeFloor !== 'all' && activeFloor !== lv) {
        setActiveFloor(lv)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId])

  // Auto-scroll do wybranej karty
  useEffect(() => {
    if (!selectedRoomId) return
    const handle = window.setTimeout(() => {
      selectedRoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(handle)
  }, [selectedRoomId])

  // ── Stats banner ─────────────────────────────────────────────────
  const totalRooms = rooms.length
  const totalFloors = floorList.length || 1
  const hasMatches = filteredRooms.length > 0
  const directionsHref = googleMapsDirectionsUrl(
    { lat: building.lat, lng: building.lng },
    userLocation,
  )

  // ── Render ───────────────────────────────────────────────────────

  if (viewMode === '3d') {
    return (
      <div className="flex h-full w-full flex-col bg-zinc-100 dark:bg-zinc-950">
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 border-b border-zinc-200 dark:border-white/10 bg-white/85 dark:bg-zinc-900/70 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode('directory')}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-white dark:border-white/20 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ChevronLeft size={13} strokeWidth={2.5} aria-hidden />
            Wróć do listy
          </button>
          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
            <Box size={13} strokeWidth={2.25} aria-hidden />
            Schemat 3D · {totalFloors} {totalFloors === 1 ? 'piętro' : 'piętra'}
          </p>
        </div>
        <div className="relative flex-1 min-h-0">
          <Suspense fallback={<DirectoryLoader text="Ładuję widok 3D… (~600KB)" />}>
            <ExplodedBuildingView
              building={building}
              rooms={rooms}
              roomsLoading={roomsLoading}
              selectedRoomId={selectedRoomId}
              onPickRoom={onPickRoom}
            />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* ── Banner — warm charcoal w dark (zero navy/blue tint) ── */}
      <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-white/10 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 mb-1">
              <MapPin size={11} strokeWidth={2.5} className="text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 dark:text-brand-gold-bright/70">
                {building.short_name ?? 'Budynek UJ'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white leading-snug">
              {building.name}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {building.address}
            </p>
          </div>

          {/* Quick-actions — Dojazd (primary), Widok 3D (secondary, bardziej
              widoczny niż wcześniej), close button (icon-only). */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] hover:bg-[#1e293b]/90 px-3.5 py-2 text-[11px] font-bold text-white transition-colors shadow-sm dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold"
            >
              <ExternalLink size={12} strokeWidth={2.5} aria-hidden />
              Dojazd
            </a>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className="group inline-flex items-center gap-1.5 rounded-full border-2 border-[#1e293b]/30 bg-white/85 hover:border-[#1e293b]/60 hover:bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#1e293b] transition-colors dark:border-brand-gold/45 dark:bg-zinc-900/70 dark:text-brand-gold-bright dark:hover:border-brand-gold dark:hover:bg-zinc-800"
              title="Pokaż schemat 3D budynku"
            >
              <Box size={13} strokeWidth={2.5} aria-hidden />
              Widok 3D
              <span className="hidden sm:inline rounded-full bg-[#1e293b]/10 px-1.5 py-px text-[9px] font-bold tracking-wider dark:bg-brand-gold/15">
                PODGLĄD
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/80 hover:bg-white p-2 text-zinc-700 transition-colors dark:border-white/15 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Zamknij katalog budynku"
              title="Zamknij (Esc)"
            >
              <X size={14} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
          <StatPill icon={Building2} value={`${totalRooms}`} label={pluralRoom(totalRooms)} />
          <StatPill icon={Layers} value={`${totalFloors}`} label={totalFloors === 1 ? 'piętro' : 'piętra'} />
          {distanceKm !== null && (
            <StatPill
              icon={MapPin}
              value={formatDistance(distanceKm)}
              label={`~${walkingMinutes(distanceKm)} min pieszo`}
              highlight
            />
          )}
        </div>

        {building.description && (
          <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug max-w-prose">
            {building.description}
          </p>
        )}
      </div>

      {/* ── Search + floor tabs ─────────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 border-b border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-sm space-y-2">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 dark:border-white/15 dark:bg-zinc-900">
          <Search size={14} strokeWidth={2.25} className="shrink-0 text-zinc-500" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Szukaj w ${totalRooms} ${pluralRoom(totalRooms)}…`}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-zinc-900 placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="p-1 rounded-full text-zinc-500 hover:bg-black/5 dark:hover:bg-white/8"
              aria-label="Wyczyść"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Floor tabs — pokazywane TYLKO gdy >1 piętro w DB */}
        {floorList.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
            <FloorTab
              active={activeFloor === 'all'}
              onClick={() => setActiveFloor('all')}
              label="Wszystkie"
              count={totalRooms}
            />
            {floorList.map((lv) => (
              <FloorTab
                key={lv}
                active={activeFloor === lv}
                onClick={() => setActiveFloor(lv)}
                label={labelForLevel(lv)}
                count={countByFloor.get(lv) ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Body: room grid + floating 3D button ───────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {/* Floating FAB — "Widok 3D" zawsze widoczny w prawym dolnym rogu,
            niezależnie od scroll'a. Ekspozycja opcji bez chowania jej
            w bannerze. Hidden gdy brak sal (wtedy 3D nie ma sensu). */}
        {!roomsLoading && rooms.length > 0 && (
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className="fixed sm:absolute bottom-12 right-4 sm:bottom-6 sm:right-6 z-30 inline-flex items-center gap-2 rounded-full bg-[#1e293b] hover:bg-[#1e293b]/90 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-black/40 ring-2 ring-white/20 transition-all hover:scale-[1.03] active:scale-95 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold dark:ring-brand-gold/30"
            aria-label="Pokaż schemat 3D budynku"
            title="Schemat 3D — wizualizacja pięter i sal"
          >
            <Box size={16} strokeWidth={2.5} aria-hidden />
            <span>Schemat 3D</span>
            <span className="rounded-full bg-white/15 px-1.5 py-px text-[9px] font-bold tracking-wider dark:bg-zinc-900/30">
              PODGLĄD
            </span>
          </button>
        )}

        {roomsLoading && rooms.length === 0 && (
          <DirectoryLoader text="Ładuję sale…" />
        )}

        {!roomsLoading && rooms.length === 0 && (
          <EmptyState
            title="Brak sal w bazie dla tego budynku"
            body="Mapowanie sal UJ jest stopniowe — wracaj sprawdzić."
          />
        )}

        {!roomsLoading && rooms.length > 0 && !hasMatches && (
          <EmptyState
            title={q ? `Nic dla "${query}"` : 'Brak sal na tym piętrze'}
            body={q ? 'Spróbuj inny kod lub nazwę.' : 'Zmień piętro w tabach powyżej.'}
          />
        )}

        {hasMatches && (
          <div className="p-4 sm:p-6">
            {/* Gdy "Wszystkie" → grupowanie po piętrach. Gdy single → płaska siatka */}
            {activeFloor === 'all' && floorList.length > 1 ? (
              <div className="space-y-5">
                {floorList.map((lv) => {
                  const onFloor = filteredRooms.filter((r) => (r.floor ?? 0) === lv)
                  if (onFloor.length === 0) return null
                  return (
                    <section key={lv}>
                      <div className="mb-2 flex items-center gap-2">
                        <Layers size={12} strokeWidth={2.25} className="text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
                        <h3 className="text-[11px] uppercase tracking-[0.16em] font-extrabold text-zinc-700 dark:text-zinc-200">
                          {labelForLevel(lv)}
                        </h3>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {onFloor.length} {pluralRoom(onFloor.length)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {onFloor.map((r) => (
                          <RoomCard
                            key={r.id}
                            room={r}
                            isSelected={selectedRoomId === r.id}
                            selectedRoomRef={selectedRoomRef}
                            onClick={() => onPickRoom(r.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredRooms.map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    isSelected={selectedRoomId === r.id}
                    selectedRoomRef={selectedRoomRef}
                    onClick={() => onPickRoom(r.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 sm:px-6 py-1.5 border-t border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
        Sale z bazy UJverse · OSM footprints · pełne plany UJ nie są publicznie dostępne
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  highlight,
}: {
  icon: typeof Layers
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <div className={`inline-flex items-baseline gap-1.5 ${highlight ? 'text-[#1e293b] dark:text-brand-gold-bright' : 'text-zinc-700 dark:text-zinc-300'}`}>
      <Icon size={11} strokeWidth={2.5} className="self-center" aria-hidden />
      <span className="font-bold">{value}</span>
      <span className="text-zinc-500 dark:text-zinc-400 font-medium">{label}</span>
    </div>
  )
}

function FloorTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
        active
          ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-zinc-900'
          : 'border border-zinc-300 bg-white/70 text-zinc-700 hover:bg-white dark:border-white/15 dark:bg-black/45 dark:text-zinc-300 dark:hover:bg-black/60'
      }`}
    >
      {label}
      <span className={`text-[9px] font-semibold ${active ? 'opacity-75' : 'opacity-55'}`}>
        {count}
      </span>
    </button>
  )
}

function RoomCard({
  room,
  isSelected,
  selectedRoomRef,
  onClick,
}: {
  room: Room
  isSelected: boolean
  selectedRoomRef: React.RefObject<HTMLButtonElement | null>
  onClick: () => void
}) {
  const kind = detectKind(room.code, room.capacity)
  const meta = KIND_META[kind]
  const Icon = meta.icon
  const hasCustomName = room.display_name && room.display_name !== `Sala ${room.code}`

  return (
    <button
      ref={isSelected ? selectedRoomRef : null}
      type="button"
      onClick={onClick}
      className={`group relative text-left rounded-2xl border transition-all overflow-hidden ${
        isSelected
          ? 'border-[#1e293b] bg-[#1e293b]/5 dark:border-brand-gold-bright dark:bg-brand-gold-bright/10 ring-2 ring-[#1e293b]/25 dark:ring-brand-gold-bright/35 shadow-md'
          : 'border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-white/25 dark:hover:bg-zinc-800'
      }`}
    >
      <div className="p-3 flex items-start gap-3">
        {/* Kind icon — UJ brand colors only (slate / gold), no blue/sky. */}
        <div
          className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${
            kind === 'aula'
              ? 'bg-amber-200/70 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200'
              : kind === 'lab'
              ? 'bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:text-amber-100/85'
              : 'bg-zinc-100 text-zinc-700 dark:bg-white/8 dark:text-zinc-300'
          }`}
        >
          <Icon size={16} strokeWidth={2.25} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          {/* Top: kod + kind label */}
          <div className="flex items-baseline gap-2">
            <p className="font-mono text-base font-extrabold text-zinc-900 dark:text-white tracking-tight truncate">
              {room.code}
            </p>
            <span className={`text-[9px] uppercase tracking-wider font-bold shrink-0 ${
              isSelected
                ? 'text-[#1e293b] dark:text-brand-gold-bright'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              {meta.label}
            </span>
          </div>

          {/* Display name */}
          {hasCustomName && (
            <p className="mt-0.5 text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2">
              {room.display_name}
            </p>
          )}

          {/* Bottom: metrics */}
          <div className="mt-1.5 flex items-center gap-2.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Layers size={10} strokeWidth={2.5} aria-hidden />
              {describeFloor(room.floor)}
            </span>
            {room.capacity !== null && (
              <span className="inline-flex items-center gap-1">
                <Users size={10} strokeWidth={2.5} aria-hidden />
                {room.capacity}
              </span>
            )}
            {(room.notes ?? '').toLowerCase().includes('dostęp') && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Accessibility size={10} strokeWidth={2.5} aria-hidden />
              </span>
            )}
          </div>

          {/* Notes — pierwsza linia */}
          {room.notes && (
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 italic">
              {room.notes}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function DirectoryLoader({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-[#1e293b] dark:border-white/20 dark:border-t-brand-gold-bright" />
        <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{text}</p>
      </div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="text-center max-w-sm">
        <div className="inline-block w-12 h-12 rounded-full bg-zinc-200 dark:bg-white/8 flex items-center justify-center mb-3">
          <Search size={20} strokeWidth={2} className="text-zinc-500 dark:text-zinc-400" aria-hidden />
        </div>
        <p className="text-sm font-bold text-zinc-900 dark:text-white">{title}</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{body}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function describeFloor(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return 'parter'
  if (floor === 0) return 'parter'
  if (floor > 0) return `${floor}. piętro`
  return `piwnica ${floor}`
}

function labelForLevel(level: number): string {
  if (level === 0) return 'Parter'
  if (level > 0) return `${level}. piętro`
  return `Piwnica ${level}`
}

function pluralRoom(n: number): string {
  if (n === 1) return 'sala'
  if (n >= 2 && n <= 4) return 'sale'
  return 'sal'
}

