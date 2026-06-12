import { useMemo } from 'react'
import { Users } from 'lucide-react'
import type { Building } from '../../services/SaleFinderService'
import {
  footprintBbox,
  layoutFloor,
  localProjection,
  ringToMeters,
  type FootprintFeature,
} from '../../services/Campus3DService'

/**
 * FloorPlan2D — schematyczny plan pojedynczego piętra w SVG.
 *
 * Estetyka: modern architectural blueprint, NIE primary-colors paint.
 *   - Bardzo subtelne tinty per kind (różnica ledwo widoczna, ale jest)
 *   - Selected = mocny gold accent — JEDYNA wibrująca rzecz na planie
 *   - Hatched pattern dla obszaru bez sal w DB ("niezindeksowane")
 *   - Cienkie ściany (blueprint-style) zamiast grubych borderów
 *
 * Algorytm layoutu sal (`layoutFloor` z Campus3DService) używa realnych
 * rozmiarów klas (5-9m), więc gdy budynek ma 3 sale w DB i 40m długości,
 * sale są realne małe a reszta to hatched "brak danych" — uczciwe.
 *
 * Działa bez WebGL, mobile-friendly, vector → ostre przy każdym zoomie.
 */

type Props = {
  building: Building
  /** Sale na DANYM piętrze (parent filtruje przed przekazaniem). */
  rooms: Array<{
    id: string
    code: string
    capacity: number | null
    floor: number | null
    display_name?: string | null
  }>
  footprint: FootprintFeature | null
  selectedRoomId: string | null
  onPickRoom: (roomId: string) => void
  theme: 'light' | 'dark'
}

// ── Paleta — bardzo stonowane tinty + JEDEN mocny accent dla selected ─
const COLORS = {
  light: {
    bgGradient: ['#f5f0e6', '#ede6d3'],   // ciepły papierowy
    buildingFill: '#ffffff',
    buildingStroke: '#1e293b',
    hatchStroke: '#94a3b8',
    corridor: '#e9e4d8',
    corridorLine: '#94a3b8',
    aula: { fill: '#fff4dc', stroke: '#1e293b' },         // bardzo lekki cream
    lab: { fill: '#eef2f9', stroke: '#1e293b' },          // bardzo lekki blue
    standard: { fill: '#fafaf3', stroke: '#1e293b' },     // off-white
    selected: { fill: '#fde047', stroke: '#1e293b' },     // GOLD ACCENT
    selectedHalo: 'rgba(250, 204, 21, 0.35)',
    text: '#0f172a',
    textMuted: '#64748b',
    textOnSelected: '#0f172a',
  },
  dark: {
    bgGradient: ['#0a0e1c', '#161a2e'],   // deep navy → slate
    buildingFill: '#1a1f33',
    buildingStroke: '#fde68a',
    hatchStroke: '#334155',
    corridor: '#0f1428',
    corridorLine: '#475569',
    aula: { fill: '#252a40', stroke: '#fde68a' },        // bardzo lekki warm tint
    lab: { fill: '#1d2740', stroke: '#fde68a' },         // bardzo lekki cool tint
    standard: { fill: '#1e2336', stroke: '#fde68a' },    // close to building fill
    selected: { fill: '#facc15', stroke: '#fde047' },    // GOLD ACCENT
    selectedHalo: 'rgba(250, 204, 21, 0.45)',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    textOnSelected: '#0f172a',
  },
}

export default function FloorPlan2D({
  building,
  rooms,
  footprint,
  selectedRoomId,
  onPickRoom,
  theme,
}: Props) {
  const palette = COLORS[theme]

  // ── Projection footprintu do lokalnych metrów ──────────────────────
  const geom = useMemo(() => {
    if (!footprint) {
      return {
        outline: null as Array<{ x: number; z: number }> | null,
        width: 30,
        depth: 40,
      }
    }
    const outerRing = footprint.geometry.coordinates[0]
    const project = localProjection(building.lat, building.lng)
    const bbox = footprintBbox(outerRing, project)
    const meters = ringToMeters(outerRing, project)
    const cx = (bbox.minX + bbox.maxX) / 2
    const cz = (bbox.minZ + bbox.maxZ) / 2
    const outline = meters.map((p) => ({ x: p.x - cx, z: p.z - cz }))
    return { outline, width: bbox.width, depth: bbox.depth }
  }, [footprint, building.lat, building.lng])

  // ── Layout sal + korytarzy ─────────────────────────────────────────
  const layout = useMemo(() => {
    return layoutFloor(
      rooms.map((r) => ({ id: r.id, code: r.code, capacity: r.capacity })),
      geom.width,
      geom.depth,
    )
  }, [rooms, geom.width, geom.depth])

  const roomLookup = useMemo(() => {
    const m = new Map<string, Props['rooms'][number]>()
    for (const r of rooms) m.set(r.id, r)
    return m
  }, [rooms])

  // ── ViewBox SVG — padding 8m wokół budynku ─────────────────────────
  const PADDING = 8
  const vbW = geom.width + 2 * PADDING
  const vbD = geom.depth + 2 * PADDING
  const vbX = -vbW / 2
  const vbZ = -vbD / 2

  // Krok grid'a dla decorative grid w tle
  const gridStep = 5

  // SVG path obrysu budynku.
  const buildingPath = useMemo(() => {
    if (!geom.outline || geom.outline.length === 0) {
      const w = geom.width / 2
      const d = geom.depth / 2
      return `M ${-w} ${-d} L ${w} ${-d} L ${w} ${d} L ${-w} ${d} Z`
    }
    const pts = geom.outline
    return (
      `M ${pts[0].x.toFixed(2)} ${pts[0].z.toFixed(2)} ` +
      pts
        .slice(1)
        .map((p) => `L ${p.x.toFixed(2)} ${p.z.toFixed(2)}`)
        .join(' ') +
      ' Z'
    )
  }, [geom.outline, geom.width, geom.depth])

  // Stable IDs dla SVG defs (gdy więcej niż 1 FloorPlan2D w DOM).
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), [])
  const hatchId = `hatch-${uid}`
  const gridId = `grid-${uid}`
  const buildingClipId = `clip-${uid}`
  const bgGradId = `bg-${uid}`

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        viewBox={`${vbX} ${vbZ} ${vbW} ${vbD}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full select-none"
      >
        <defs>
          {/* Subtle background gradient */}
          <linearGradient id={bgGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.bgGradient[0]} />
            <stop offset="100%" stopColor={palette.bgGradient[1]} />
          </linearGradient>

          {/* Hatched pattern dla "niezindeksowane" sale */}
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width="2.4"
            height="2.4"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="2.4"
              stroke={palette.hatchStroke}
              strokeWidth="0.35"
              opacity="0.55"
            />
          </pattern>

          {/* Subtle grid in background */}
          <pattern id={gridId} width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke={palette.hatchStroke}
              strokeWidth="0.08"
              opacity="0.35"
            />
          </pattern>

          {/* Clip-path do obrysu budynku — żeby hatch nie wychodził poza */}
          <clipPath id={buildingClipId}>
            <path d={buildingPath} />
          </clipPath>
        </defs>

        {/* ── Tło: gradient + subtelna siatka ────────────────────────── */}
        <rect x={vbX} y={vbZ} width={vbW} height={vbD} fill={`url(#${bgGradId})`} />
        <rect x={vbX} y={vbZ} width={vbW} height={vbD} fill={`url(#${gridId})`} />

        {/* ── Subtle shadow pod budynkiem ──────────────────────────── */}
        <path
          d={buildingPath}
          fill={theme === 'dark' ? '#000000' : '#0f172a'}
          opacity={theme === 'dark' ? 0.45 : 0.15}
          transform="translate(0.8, 1.2)"
          filter="blur(1px)"
        />

        {/* ── Obrys budynku z fill ─────────────────────────────────── */}
        <path
          d={buildingPath}
          fill={palette.buildingFill}
          stroke={palette.buildingStroke}
          strokeWidth={0.5}
          strokeLinejoin="round"
        />

        {/* ── Wewnątrz budynku: hatched pattern (= "niezindeksowane") ─
            Wszystko clip'owane do obrysu, więc nie wycieka na zewnątrz.
            Sale i korytarze renderowane NA WIERZCHU pokryją hatching tam
            gdzie wiemy co jest. Reszta zostaje hatched → wizualnie "?". */}
        <g clipPath={`url(#${buildingClipId})`}>
          <rect x={vbX} y={vbZ} width={vbW} height={vbD} fill={`url(#${hatchId})`} />

          {/* ── Korytarze — solid color przykrywa hatching ─────────── */}
          {layout.corridors.map((c, i) => (
            <g key={`corridor-${i}`}>
              <rect
                x={c.x - c.width / 2}
                y={c.z - c.depth / 2}
                width={c.width}
                height={c.depth}
                fill={palette.corridor}
              />
              {/* Linia środkowa korytarza — subtle dashed gold */}
              {c.depth > c.width ? (
                <line
                  x1={c.x}
                  y1={c.z - c.depth / 2 + 0.6}
                  x2={c.x}
                  y2={c.z + c.depth / 2 - 0.6}
                  stroke={palette.corridorLine}
                  strokeWidth={0.18}
                  strokeDasharray="1.2 0.8"
                  opacity={0.6}
                />
              ) : (
                <line
                  x1={c.x - c.width / 2 + 0.6}
                  y1={c.z}
                  x2={c.x + c.width / 2 - 0.6}
                  y2={c.z}
                  stroke={palette.corridorLine}
                  strokeWidth={0.18}
                  strokeDasharray="1.2 0.8"
                  opacity={0.6}
                />
              )}
            </g>
          ))}

          {/* ── Sale ─────────────────────────────────────────────── */}
          {layout.rooms.map((box) => {
            const room = roomLookup.get(box.roomId)
            if (!room) return null
            const isSelected = selectedRoomId === room.id
            const kindPalette = palette[box.kind]
            const fill = isSelected ? palette.selected.fill : kindPalette.fill
            const stroke = isSelected ? palette.selected.stroke : kindPalette.stroke
            const strokeWidth = isSelected ? 0.55 : 0.22

            const labelFontSize = Math.min(
              1.4,
              Math.max(0.7, Math.min(box.width, box.depth) * 0.2),
            )

            return (
              <g key={room.id}>
                {/* Halo dla selected — soft glow */}
                {isSelected && (
                  <rect
                    x={box.x - box.width / 2 - 1.2}
                    y={box.z - box.depth / 2 - 1.2}
                    width={box.width + 2.4}
                    height={box.depth + 2.4}
                    rx={1.5}
                    ry={1.5}
                    fill={palette.selectedHalo}
                  />
                )}
                <rect
                  x={box.x - box.width / 2}
                  y={box.z - box.depth / 2}
                  width={box.width}
                  height={box.depth}
                  rx={0.4}
                  ry={0.4}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  className="cursor-pointer transition-[fill,stroke,stroke-width]"
                  onClick={() => onPickRoom(room.id)}
                />
                {/* Label — kod sali */}
                <text
                  x={box.x}
                  y={box.z - (room.display_name && room.display_name !== `Sala ${room.code}` ? labelFontSize * 0.45 : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={labelFontSize}
                  fontWeight={700}
                  fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
                  fill={isSelected ? palette.textOnSelected : palette.text}
                  style={{ pointerEvents: 'none', letterSpacing: '-0.02em' }}
                >
                  {room.code}
                </text>
                {/* Display name jako mała "metryka" pod kodem */}
                {room.display_name &&
                  room.display_name !== `Sala ${room.code}` &&
                  box.depth > 5 && (
                    <text
                      x={box.x}
                      y={box.z + labelFontSize * 0.7}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelFontSize * 0.5}
                      fontWeight={500}
                      fontFamily="ui-sans-serif, system-ui"
                      fill={isSelected ? palette.textOnSelected : palette.textMuted}
                      style={{ pointerEvents: 'none' }}
                    >
                      {truncate(room.display_name, 22)}
                    </text>
                  )}
                {/* Capacity dla auli — jako mała pin */}
                {box.kind === 'aula' && room.capacity && box.depth > 6 && (
                  <text
                    x={box.x}
                    y={box.z + labelFontSize * 1.45}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={labelFontSize * 0.42}
                    fontWeight={600}
                    fontFamily="ui-sans-serif, system-ui"
                    fill={isSelected ? palette.textOnSelected : palette.textMuted}
                    style={{ pointerEvents: 'none' }}
                  >
                    {room.capacity} miejsc
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* ── Strzałka północy ─────────────────────────────────────── */}
        <g transform={`translate(${vbX + 4} ${vbZ + 4})`}>
          <circle r={2} fill={palette.buildingFill} stroke={palette.buildingStroke} strokeWidth={0.18} opacity={0.95} />
          <path
            d="M 0 -1.3 L 0.55 0.4 L 0 0 L -0.55 0.4 Z"
            fill={palette.text}
          />
          <text
            x={0}
            y={1.25}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.75}
            fontWeight={800}
            fontFamily="ui-sans-serif, system-ui"
            fill={palette.text}
          >
            N
          </text>
        </g>

        {/* ── Skala 10m ──────────────────────────────────────────── */}
        <g transform={`translate(${vbX + vbW - 14} ${vbZ + vbD - 4})`}>
          <line x1={0} y1={0} x2={10} y2={0} stroke={palette.text} strokeWidth={0.22} />
          <line x1={0} y1={-0.55} x2={0} y2={0.55} stroke={palette.text} strokeWidth={0.22} />
          <line x1={10} y1={-0.55} x2={10} y2={0.55} stroke={palette.text} strokeWidth={0.22} />
          <text
            x={5}
            y={1.7}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.85}
            fontWeight={700}
            fontFamily="ui-sans-serif, system-ui"
            fill={palette.text}
          >
            10 m
          </text>
        </g>
      </svg>

      {/* ── Pusty stan ────────────────────────────────────────────── */}
      {rooms.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-zinc-300 bg-white/95 px-4 py-3 text-center shadow-md dark:border-white/15 dark:bg-black/85">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              Brak sal w bazie na tym piętrze
            </p>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
              Obrys budynku z OSM · sale do dodania
            </p>
          </div>
        </div>
      )}

      {/* ── Sticker: liczba sal ──────────────────────────────────── */}
      {rooms.length > 0 && (
        <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-white/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-zinc-900 inline-flex items-center gap-1.5 border border-zinc-200 shadow-sm dark:bg-black/75 dark:text-zinc-100 dark:border-white/15">
          <Users size={12} strokeWidth={2.5} aria-hidden />
          {rooms.length} {pluralRoom(rooms.length)}
        </div>
      )}

      {/* ── Sticker: info o hatched ──────────────────────────────── */}
      {rooms.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 max-w-[200px] rounded-xl bg-white/85 backdrop-blur-md px-2.5 py-1.5 text-[10px] text-zinc-700 inline-flex items-start gap-1.5 border border-zinc-200 shadow-sm dark:bg-black/65 dark:text-zinc-300 dark:border-white/10">
          <span
            className="inline-block w-3 h-3 mt-0.5 shrink-0 rounded-sm"
            style={{
              background: theme === 'dark'
                ? 'repeating-linear-gradient(45deg, #334155 0, #334155 1px, transparent 1px, transparent 3px)'
                : 'repeating-linear-gradient(45deg, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 3px)',
              border: `1px solid ${theme === 'dark' ? '#475569' : '#cbd5e1'}`,
            }}
          />
          <span className="leading-tight">Kreskowane = brak danych w bazie</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function pluralRoom(n: number): string {
  if (n === 1) return 'sala'
  if (n >= 2 && n <= 4) return 'sale'
  return 'sal'
}
