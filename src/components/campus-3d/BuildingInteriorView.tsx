import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Box, ChevronLeft, ChevronRight, HelpCircle, Info, Layers, Map as MapIcon } from 'lucide-react'
import type { Building, Room } from '../../services/SaleFinderService'
import {
  groupRoomsByFloor,
  loadFootprint,
  type FootprintFeature,
} from '../../services/Campus3DService'
import { useTheme } from '../../ThemeContext'
import FloorPlan2D from './FloorPlan2D'

// 3D scene jest ciężki (~600KB gzipped). Lazy-load TYLKO gdy user
// przełączy na widok 3D.
const ExplodedBuildingView = lazy(() => import('./ExplodedBuildingView'))

/**
 * BuildingInteriorView — orchestrator widoku wnętrza budynku.
 *
 * Hybrid UX:
 *   - Default: 2D plan piętra (SVG, czytelny, klikalny, vector).
 *   - Toggle "Widok 3D": exploded view ze stosem pięter.
 *
 * Top bar:
 *   - Floor tabs (parter, 1, 2, 3...) — 2D only, 3D pokazuje wszystkie.
 *   - 2D / 3D toggle.
 *   - "Co tu jest?" — toggle legendy (kolory sal, korytarz, schemat info).
 *
 * Schemat info:
 *   Wnętrza są PROCEDURALNIE generowane — NIE są to realne plany UJ.
 *   Pokazujemy schemat oparty o numery sal, capacity i liczbę pięter.
 *   Korzystanie: znajdź swoją salę w liście, zobacz mniej-więcej gdzie
 *   w budynku jest, idź na zajęcia.
 */

type Props = {
  building: Building
  rooms: Room[]
  roomsLoading: boolean
  selectedRoomId: string | null
  onPickRoom: (roomId: string) => void
}

type ViewMode = '2d' | '3d'

export default function BuildingInteriorView({
  building,
  rooms,
  roomsLoading,
  selectedRoomId,
  onPickRoom,
}: Props) {
  const { theme } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [showLegend, setShowLegend] = useState(false)
  const [footprint, setFootprint] = useState<FootprintFeature | null>(null)
  const [footprintLoading, setFootprintLoading] = useState(true)

  // Floor selector — wszystkie poziomy z DB sale + (jeśli OSM ma więcej)
  // dorzucamy "puste piętra" do liczby pięter z footprintu.
  const floorGroups = useMemo(() => groupRoomsByFloor(rooms), [rooms])

  // Wyliczone wszystkie poziomy (od piwnic z DB do top z OSM).
  const allFloors = useMemo(() => {
    const dbMin = floorGroups.length > 0 ? floorGroups[0].level : 0
    const dbMax = floorGroups.length > 0 ? floorGroups[floorGroups.length - 1].level : 0
    const osmTop = footprint?.properties.levels ?? null
    const top = Math.max(dbMax, osmTop !== null ? osmTop - 1 : dbMax)
    const bottom = Math.min(dbMin, 0)
    const out: number[] = []
    for (let lv = bottom; lv <= top; lv++) out.push(lv)
    return out.length === 0 ? [0] : out
  }, [floorGroups, footprint])

  // Default floor: 0 (parter) lub najniższy z DB jeśli wszystko jest
  // w piwnicy (rzadkie).
  const [activeFloor, setActiveFloor] = useState<number>(0)

  // Załaduj footprint na mount.
  useEffect(() => {
    let cancelled = false
    setFootprintLoading(true)
    void loadFootprint(building.id).then((fp) => {
      if (cancelled) return
      setFootprint(fp)
      setFootprintLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [building.id])

  // Auto-reset active floor gdy zmienia się budynek.
  useEffect(() => {
    setActiveFloor(0)
  }, [building.id])

  // Auto-przełącz na piętro wybranej sali (gdy klikasz w listę po prawej).
  useEffect(() => {
    if (!selectedRoomId) return
    const room = rooms.find((r) => r.id === selectedRoomId)
    if (room && room.floor !== null && room.floor !== activeFloor) {
      setActiveFloor(room.floor)
    }
    // ESLint: chcemy SKAKAĆ tylko gdy zmienia się selectedRoomId, nie
    // za każdym razem gdy user przełącza piętro ręcznie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId])

  // Filtruj sale tylko z aktywnego piętra.
  const roomsOnActiveFloor = useMemo(
    () => rooms.filter((r) => (r.floor ?? 0) === activeFloor),
    [rooms, activeFloor],
  )

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col bg-zinc-100 dark:bg-[#070a18]">
      {/* ── Top bar: floor tabs + view toggle + legend toggle ─────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 sm:px-6 py-2.5 border-b border-zinc-200 dark:border-white/10 bg-white/85 dark:bg-black/55 backdrop-blur-md">
        {/* Floor selector — tylko w 2D mode (3D pokazuje wszystkie) */}
        {viewMode === '2d' ? (
          <FloorTabs
            floors={allFloors}
            active={activeFloor}
            onSelect={setActiveFloor}
            floorGroups={floorGroups}
          />
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
            <Layers size={13} strokeWidth={2.25} aria-hidden />
            <span>{allFloors.length} {allFloors.length === 1 ? 'piętro' : 'piętra'}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* 2D / 3D toggle */}
          <div className="inline-flex rounded-full border border-zinc-300 dark:border-white/20 overflow-hidden bg-white/70 dark:bg-black/40 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors ${
                viewMode === '2d'
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-black'
                  : 'text-zinc-700 hover:bg-black/4 dark:text-zinc-300 dark:hover:bg-white/8'
              }`}
              title="Plan piętra (2D)"
            >
              <MapIcon size={13} strokeWidth={2.5} aria-hidden />
              Plan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors border-l border-zinc-300 dark:border-white/20 ${
                viewMode === '3d'
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-black'
                  : 'text-zinc-700 hover:bg-black/4 dark:text-zinc-300 dark:hover:bg-white/8'
              }`}
              title="Widok 3D"
            >
              <Box size={13} strokeWidth={2.5} aria-hidden />
              3D
            </button>
          </div>

          {/* Legend toggle */}
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className={`p-2 rounded-full transition-colors ${
              showLegend
                ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-black'
                : 'border border-zinc-300 bg-white/70 text-zinc-700 hover:bg-white dark:border-white/20 dark:bg-black/40 dark:text-zinc-300 dark:hover:bg-black/60'
            }`}
            aria-label={showLegend ? 'Ukryj legendę' : 'Pokaż legendę'}
            title={showLegend ? 'Ukryj legendę' : 'Co znaczą kolory?'}
          >
            <HelpCircle size={15} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>

      {/* ── Body: 2D plan lub 3D exploded ─────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        {viewMode === '2d' ? (
          footprintLoading ? (
            <PlanLoader text="Ładuję obrys budynku z OSM…" />
          ) : (
            <FloorPlan2D
              building={building}
              rooms={roomsOnActiveFloor}
              footprint={footprint}
              selectedRoomId={selectedRoomId}
              onPickRoom={onPickRoom}
              theme={theme}
            />
          )
        ) : (
          <Suspense fallback={<PlanLoader text="Ładuję widok 3D wnętrz… (~600KB)" />}>
            <ExplodedBuildingView
              building={building}
              rooms={rooms}
              roomsLoading={roomsLoading}
              selectedRoomId={selectedRoomId}
              onPickRoom={onPickRoom}
            />
          </Suspense>
        )}

        {/* ── Legenda (slide-up overlay) ──────────────────────────────── */}
        {showLegend && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:max-w-md rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-white/20 dark:bg-black/85">
            <div className="flex items-start gap-2">
              <Info size={14} strokeWidth={2.25} className="mt-0.5 shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-extrabold text-zinc-900 dark:text-white">
                  Schemat wnętrza — nie realny plan UJ
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">
                  Obrys budynku pochodzi z OpenStreetMap. Sale rozmieszczone proceduralnie
                  wg numerów + capacity. Daje pojęcie GDZIE jest sala, nie dokładne metry.
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-semibold">
                  <LegendSwatch color="#fafaf3" stroke="#1e293b" label="Sala standardowa" />
                  <LegendSwatch color="#fff4dc" stroke="#1e293b" label="Aula / audytorium" />
                  <LegendSwatch color="#eef2f9" stroke="#1e293b" label="Laboratorium" />
                  <LegendSwatch color="#e9e4d8" stroke="#94a3b8" label="Korytarz" />
                  <LegendSwatch color="#fde047" stroke="#1e293b" label="Wybrana sala" />
                  <LegendHatch label="Brak danych" />
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  <kbd className="rounded bg-black/8 px-1 dark:bg-white/10">Klik</kbd> w salę aby
                  zaznaczyć ·{' '}
                  <kbd className="rounded bg-black/8 px-1 dark:bg-white/10">Plan ↔ 3D</kbd> aby przełączyć widok
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                className="shrink-0 p-1 rounded-full text-zinc-500 hover:bg-black/8 dark:hover:bg-white/10"
                aria-label="Zamknij legendę"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Onboarding hint — pokazany TYLKO przy pierwszym renderze, jeśli
            user nie kliknął jeszcze legendy. Mała "podpowiedź" do helpa. */}
        {!showLegend && viewMode === '2d' && rooms.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLegend(true)}
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 backdrop-blur-md hover:bg-white dark:border-white/20 dark:bg-black/70 dark:text-zinc-200 dark:hover:bg-black/85"
            title="Co znaczą kolory?"
          >
            <HelpCircle size={12} strokeWidth={2.5} aria-hidden />
            Co znaczą kolory?
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function FloorTabs({
  floors,
  active,
  onSelect,
  floorGroups,
}: {
  floors: number[]
  active: number
  onSelect: (lv: number) => void
  floorGroups: Array<{ level: number; rooms: unknown[] }>
}) {
  const countByLevel = useMemo(() => {
    const m = new Map<number, number>()
    for (const g of floorGroups) m.set(g.level, g.rooms.length)
    return m
  }, [floorGroups])

  const activeIdx = floors.indexOf(active)
  const canPrev = activeIdx > 0
  const canNext = activeIdx >= 0 && activeIdx < floors.length - 1

  return (
    <div className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={() => canPrev && onSelect(floors[activeIdx - 1])}
        disabled={!canPrev}
        className="p-1.5 rounded-full text-zinc-500 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-white/8"
        aria-label="Poprzednie piętro"
      >
        <ChevronLeft size={14} strokeWidth={2.5} />
      </button>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {floors.map((lv) => {
          const isActive = lv === active
          const count = countByLevel.get(lv) ?? 0
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onSelect(lv)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                isActive
                  ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-black'
                  : 'text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/8'
              }`}
            >
              {labelForLevel(lv)}
              {count > 0 && (
                <span className={`text-[9px] font-semibold ${isActive ? 'opacity-75' : 'opacity-55'}`}>
                  · {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => canNext && onSelect(floors[activeIdx + 1])}
        disabled={!canNext}
        className="p-1.5 rounded-full text-zinc-500 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-white/8"
        aria-label="Następne piętro"
      >
        <ChevronRight size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function PlanLoader({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-[#1e293b] dark:border-white/20 dark:border-t-brand-gold-bright" />
        <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{text}</p>
      </div>
    </div>
  )
}

function LegendSwatch({ color, stroke, label }: { color: string; stroke: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-5 h-3 rounded-sm shrink-0"
        style={{ background: color, border: `1px solid ${stroke}` }}
      />
      <span className="text-zinc-700 dark:text-zinc-200">{label}</span>
    </div>
  )
}

function LegendHatch({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-5 h-3 rounded-sm shrink-0 border border-zinc-400 dark:border-white/30"
        style={{
          background: 'repeating-linear-gradient(45deg, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 3px)',
        }}
      />
      <span className="text-zinc-700 dark:text-zinc-200">{label}</span>
    </div>
  )
}

function labelForLevel(level: number): string {
  if (level === 0) return 'Parter'
  if (level > 0) return `${level}. p.`
  return `Piwnica ${level}`
}
