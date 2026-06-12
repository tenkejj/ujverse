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
 * Domyślny widok wnętrza budynku (zamiast 3D exploded view). Wyświetla:
 *   - Obrys budynku (real OSM polygon, projected do lokalnych metrów)
 *   - Korytarze jako ciemniejsze pasy
 *   - Sale jako kolorowe rectangles wg kind (aula/lab/standard)
 *   - Klikalne sale z hover/select
 *   - Inline legenda + onboarding
 *
 * Czytelne, accurate-na-tyle-na-ile-się-da (schemat), nie udaje że
 * to realny plan UJ. Działa bez WebGL, mobile-friendly, vector → ostre
 * przy każdym zoomie.
 *
 * Algorytm layoutu sal IDENTYCZNY jak w 3D (`layoutFloor`) — czyli
 * centralny korytarz + sale w 2 kolumnach + aule na froncie. Po prostu
 * w 2D rzutowane na płaszczyznę XZ → SVG.
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
  /** Tryb kolorów — sync z global ThemeContext. */
  theme: 'light' | 'dark'
}

const COLORS = {
  light: {
    buildingFill: '#f8fafc',
    buildingStroke: '#475569',
    corridor: '#cbd5e1',
    corridorLine: '#fbbf24',
    aula: { fill: '#fef3c7', stroke: '#d97706', selected: '#fde047' },
    lab: { fill: '#dbeafe', stroke: '#2563eb', selected: '#93c5fd' },
    standard: { fill: '#fef9c3', stroke: '#a16207', selected: '#fde047' },
    text: '#0f172a',
    textMuted: '#475569',
    selectedStroke: '#0f172a',
  },
  dark: {
    buildingFill: '#0f172a',
    buildingStroke: '#fde68a',
    corridor: '#1e293b',
    corridorLine: '#fbbf24',
    aula: { fill: '#92400e', stroke: '#f59e0b', selected: '#fde047' },
    lab: { fill: '#1e3a8a', stroke: '#60a5fa', selected: '#93c5fd' },
    standard: { fill: '#713f12', stroke: '#eab308', selected: '#fde047' },
    text: '#f8fafc',
    textMuted: '#cbd5e1',
    selectedStroke: '#fde047',
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

  // ── Projection footprintu do lokalnych metrów ─────────────────────────
  // Jeśli brak footprintu, używamy syntetycznego prostokąta 30×40m.
  const geom = useMemo(() => {
    if (!footprint) {
      return {
        outline: null as Array<{ x: number; z: number }> | null,
        width: 30,
        depth: 40,
        cx: 0,
        cz: 0,
      }
    }
    const outerRing = footprint.geometry.coordinates[0]
    const project = localProjection(building.lat, building.lng)
    const bbox = footprintBbox(outerRing, project)
    const meters = ringToMeters(outerRing, project)
    const cx = (bbox.minX + bbox.maxX) / 2
    const cz = (bbox.minZ + bbox.maxZ) / 2
    // Re-centruj wszystko na (0, 0).
    const outline = meters.map((p) => ({ x: p.x - cx, z: p.z - cz }))
    return { outline, width: bbox.width, depth: bbox.depth, cx, cz }
  }, [footprint, building.lat, building.lng])

  // ── Layout sal + korytarzy z tego samego algo co 3D ──────────────────
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

  // ── ViewBox SVG — padding 6m wokół budynku ───────────────────────────
  const PADDING = 6
  const vbW = geom.width + 2 * PADDING
  const vbD = geom.depth + 2 * PADDING
  const vbX = -vbW / 2
  const vbZ = -vbD / 2

  // SVG path obrysu budynku.
  const buildingPath = useMemo(() => {
    if (!geom.outline || geom.outline.length === 0) {
      // Fallback: prostokąt.
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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        viewBox={`${vbX} ${vbZ} ${vbW} ${vbD}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full select-none"
        style={{ background: theme === 'dark' ? '#070a18' : '#e6eef7' }}
      >
        {/* ── Obrys budynku ─────────────────────────────────────────── */}
        <path
          d={buildingPath}
          fill={palette.buildingFill}
          stroke={palette.buildingStroke}
          strokeWidth={0.6}
          strokeLinejoin="round"
          opacity={0.95}
        />

        {/* ── Korytarze ─────────────────────────────────────────────── */}
        {layout.corridors.map((c, i) => (
          <g key={`corridor-${i}`}>
            <rect
              x={c.x - c.width / 2}
              y={c.z - c.depth / 2}
              width={c.width}
              height={c.depth}
              fill={palette.corridor}
              opacity={0.85}
            />
            {/* Linia środkowa korytarza — żółty pasek */}
            {c.depth > c.width ? (
              <line
                x1={c.x}
                y1={c.z - c.depth / 2 + 0.4}
                x2={c.x}
                y2={c.z + c.depth / 2 - 0.4}
                stroke={palette.corridorLine}
                strokeWidth={Math.max(0.12, c.width * 0.1)}
                strokeDasharray="0.8 0.6"
                opacity={0.7}
              />
            ) : (
              <line
                x1={c.x - c.width / 2 + 0.4}
                y1={c.z}
                x2={c.x + c.width / 2 - 0.4}
                y2={c.z}
                stroke={palette.corridorLine}
                strokeWidth={Math.max(0.12, c.depth * 0.1)}
                strokeDasharray="0.8 0.6"
                opacity={0.7}
              />
            )}
          </g>
        ))}

        {/* ── Sale ──────────────────────────────────────────────────── */}
        {layout.rooms.map((box) => {
          const room = roomLookup.get(box.roomId)
          if (!room) return null
          const isSelected = selectedRoomId === room.id
          const kindPalette = palette[box.kind]
          const fill = isSelected ? kindPalette.selected : kindPalette.fill
          const stroke = isSelected ? palette.selectedStroke : kindPalette.stroke
          const strokeWidth = isSelected ? 0.45 : 0.25

          // Sensowny rozmiar label'a — 1m wysokości w jednostkach SVG,
          // ale cap na max wymiar sali (żeby duża aula nie miała wielkiej
          // litery zajmującej cały box).
          const fontSize = Math.min(
            1.6,
            Math.max(0.8, Math.min(box.width, box.depth) * 0.22),
          )

          return (
            <g key={room.id}>
              <rect
                x={box.x - box.width / 2}
                y={box.z - box.depth / 2}
                width={box.width}
                height={box.depth}
                rx={0.3}
                ry={0.3}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                className="cursor-pointer transition-[fill,stroke] hover:brightness-110"
                onClick={() => onPickRoom(room.id)}
              />
              <text
                x={box.x}
                y={box.z}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={800}
                fontFamily="ui-sans-serif, system-ui"
                fill={palette.text}
                style={{ pointerEvents: 'none' }}
              >
                {room.code}
              </text>
              {box.kind === 'aula' && room.capacity && box.depth > 4 && (
                <text
                  x={box.x}
                  y={box.z + fontSize * 0.9}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize * 0.55}
                  fontWeight={600}
                  fontFamily="ui-sans-serif, system-ui"
                  fill={palette.textMuted}
                  style={{ pointerEvents: 'none' }}
                >
                  {room.capacity} miejsc
                </text>
              )}
            </g>
          )
        })}

        {/* ── Strzałka północy ──────────────────────────────────────── */}
        <g transform={`translate(${vbX + 3.5} ${vbZ + 3.5})`}>
          <circle r={1.6} fill={palette.buildingFill} stroke={palette.buildingStroke} strokeWidth={0.15} />
          <path
            d="M 0 -1.1 L 0.5 0.3 L 0 -0.1 L -0.5 0.3 Z"
            fill={palette.text}
          />
          <text
            x={0}
            y={1.05}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={0.7}
            fontWeight={700}
            fontFamily="ui-sans-serif, system-ui"
            fill={palette.text}
          >
            N
          </text>
        </g>

        {/* ── Skala w prawym dolnym rogu ────────────────────────────── */}
        <g transform={`translate(${vbX + vbW - 12} ${vbZ + vbD - 3.5})`}>
          <line x1={0} y1={0} x2={10} y2={0} stroke={palette.text} strokeWidth={0.18} />
          <line x1={0} y1={-0.5} x2={0} y2={0.5} stroke={palette.text} strokeWidth={0.18} />
          <line x1={10} y1={-0.5} x2={10} y2={0.5} stroke={palette.text} strokeWidth={0.18} />
          <text
            x={5}
            y={1.6}
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

      {/* ── Pusty stan ─────────────────────────────────────────────── */}
      {rooms.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/15 bg-black/65 px-4 py-3 text-center backdrop-blur-md">
            <p className="text-sm font-bold text-white">Brak sal w bazie na tym piętrze</p>
            <p className="mt-1 text-[11px] text-white/70">
              Obrys budynku z OSM, wnętrze nie jest jeszcze zindeksowane.
            </p>
          </div>
        </div>
      )}

      {/* ── Mini-info: liczba sal na piętrze ──────────────────────── */}
      {rooms.length > 0 && (
        <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-white inline-flex items-center gap-1.5">
          <Users size={12} strokeWidth={2.5} aria-hidden />
          {rooms.length} {rooms.length === 1 ? 'sala' : rooms.length < 5 ? 'sale' : 'sal'}
        </div>
      )}
    </div>
  )
}
