import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Layers, Users } from 'lucide-react'
import type { Building, Room } from '../../services/SaleFinderService'
import {
  footprintBbox,
  groupRoomsByFloor,
  loadFootprint,
  localProjection,
  ringToMeters,
  type FootprintFeature,
} from '../../services/Campus3DService'
import { useTheme } from '../../ThemeContext'
import FloorPlane from './FloorPlane'

/**
 * ExplodedBuildingView — widok 3D wnętrz pojedynczego budynku.
 *
 * Renderuje stos pięter (z `uj_rooms`) rozsuniętych w pionie. Footprint
 * piętra pochodzi z `/uj-footprints/{id}.geojson` (OSM). Sale są boxami
 * z `RoomBox` (układ schematyczny — nie realny floor plan).
 *
 * Animacja exploded:
 *   - Tryb `compact`: piętra 3.5m apart (zwarty stos).
 *   - Tryb `exploded`: piętra 8m apart (czytelne).
 *   - Toggle via prop `mode` (default `'exploded'` bo widok pokazuje się
 *     po user click "Pokaż wnętrza" — uzasadnione założenie że chce
 *     widzieć).
 *
 * Fallback gdy WebGL2 niedostępne (mobile bez akceleracji): pokazuje
 * "tekstową" reprezentację — sale per piętro, klikalne.
 */

const COMPACT_SPACING = 3.8
const EXPLODED_SPACING = 8.0

const DEFAULT_FOOTPRINT_WIDTH = 30
const DEFAULT_FOOTPRINT_DEPTH = 40

type Props = {
  building: Building
  rooms: Room[]
  roomsLoading: boolean
  selectedRoomId: string | null
  onPickRoom: (roomId: string) => void
}

export default function ExplodedBuildingView({
  building,
  rooms,
  roomsLoading,
  selectedRoomId,
  onPickRoom,
}: Props) {
  const { theme } = useTheme()
  const [footprint, setFootprint] = useState<FootprintFeature | null>(null)
  const [footprintLoading, setFootprintLoading] = useState(true)
  const [mode, setMode] = useState<'compact' | 'exploded'>('exploded')

  // ── WebGL2 detection — fallback gdy GPU/sterownik nie wspiera ────────
  const webglSupported = useMemo(() => detectWebGL(), [])

  // ── Load footprint ───────────────────────────────────────────────────
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

  // ── Compute footprint shape + dims in local meters ───────────────────
  const { shape, width, depth } = useMemo(() => {
    if (!footprint) {
      return {
        shape: null as THREE.Shape | null,
        width: DEFAULT_FOOTPRINT_WIDTH,
        depth: DEFAULT_FOOTPRINT_DEPTH,
      }
    }
    const outerRing = footprint.geometry.coordinates[0]
    // Centroid budynku z UJ_buildings jako origin lokalnej projekcji.
    // (Footprint może być przesunięty bo OSM mam inną dokładność, ale
    // dla wizualizacji szczegółów nie ma to znaczenia — chcemy budynek
    // wycentrowany w 0,0.)
    const project = localProjection(building.lat, building.lng)
    const bbox = footprintBbox(outerRing, project)
    const meters = ringToMeters(outerRing, project)
    // Wycentruj geometrię w (0, 0).
    const cx = (bbox.minX + bbox.maxX) / 2
    const cz = (bbox.minZ + bbox.maxZ) / 2
    const path = new THREE.Shape()
    if (meters.length > 0) {
      path.moveTo(meters[0].x - cx, meters[0].z - cz)
      for (let i = 1; i < meters.length; i++) {
        path.lineTo(meters[i].x - cx, meters[i].z - cz)
      }
      path.closePath()
    }
    return { shape: path, width: bbox.width, depth: bbox.depth }
  }, [footprint, building.lat, building.lng])

  // ── Floor groups + room lookup ───────────────────────────────────────
  const floorGroups = useMemo(() => groupRoomsByFloor(rooms), [rooms])
  const roomLookup = useMemo(() => {
    const m = new Map<string, Room>()
    for (const r of rooms) m.set(r.id, r)
    return m
  }, [rooms])

  // Z poziomu na Y w 3D scene. Najniższy level → y = 0, wyżej → +y.
  const minLevel = floorGroups[0]?.level ?? 0
  const spacing = mode === 'exploded' ? EXPLODED_SPACING : COMPACT_SPACING

  // ── Fallback: WebGL not supported lub nie ma sal w bazie ─────────────
  if (!webglSupported) {
    return (
      <FallbackList
        rooms={rooms}
        floorGroups={floorGroups}
        selectedRoomId={selectedRoomId}
        onPickRoom={onPickRoom}
        reason="Twoja przeglądarka nie wspiera WebGL2 — pokazuję widok tekstowy."
      />
    )
  }

  if (!roomsLoading && rooms.length === 0) {
    return (
      <FallbackList
        rooms={[]}
        floorGroups={[]}
        selectedRoomId={null}
        onPickRoom={onPickRoom}
        reason="Nie mamy jeszcze sal w bazie dla tego budynku."
      />
    )
  }

  // Mobile detection — używamy do skalowania controls + canvas perf.
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 640px)').matches
  }, [])

  return (
    <div className="relative h-full w-full">
      {/* Mode toggle (compact / exploded) — większe tap targets na mobile */}
      <div className="absolute top-3 left-3 z-10 flex rounded-full overflow-hidden border border-white/15 backdrop-blur-md shadow-md">
        <button
          type="button"
          onClick={() => setMode('exploded')}
          className={`px-3 py-2 sm:py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors min-h-[40px] sm:min-h-0 ${
            mode === 'exploded'
              ? 'bg-brand-gold-bright text-black'
              : 'bg-black/65 text-white/80 hover:bg-black/85 active:bg-black/95'
          }`}
        >
          <Layers size={14} strokeWidth={2.5} aria-hidden />
          Rozsunięte
        </button>
        <button
          type="button"
          onClick={() => setMode('compact')}
          className={`px-3 py-2 sm:py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors min-h-[40px] sm:min-h-0 ${
            mode === 'compact'
              ? 'bg-brand-gold-bright text-black'
              : 'bg-black/65 text-white/80 hover:bg-black/85 active:bg-black/95'
          }`}
        >
          <Users size={14} strokeWidth={2.5} aria-hidden />
          Zwarte
        </button>
      </div>

      {footprintLoading && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur-md">
          Ładuję footprint…
        </div>
      )}

      <Canvas
        shadows={!isMobile}
        camera={{
          position: isMobile ? [55, 50, 70] : [40, 35, 50],
          fov: isMobile ? 52 : 45,
          near: 0.1,
          far: 500,
        }}
        gl={{
          antialias: !isMobile,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        style={{
          background: theme === 'dark' ? '#070a18' : '#dbe7f3',
        }}
      >
        {/* Oświetlenie */}
        <ambientLight intensity={theme === 'dark' ? 0.35 : 0.6} />
        <directionalLight
          position={[30, 60, 30]}
          intensity={theme === 'dark' ? 1.1 : 1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />

        {/* Sky-ish hemisphere */}
        <hemisphereLight
          args={[
            theme === 'dark' ? '#1e293b' : '#cfe0f2',
            theme === 'dark' ? '#000000' : '#475569',
            0.4,
          ]}
        />

        <Suspense fallback={null}>
          {/* Bounds — auto-fit kamery do zawartości po zmianach mode/data */}
          <Bounds fit clip observe margin={1.4}>
            <group>
              {floorGroups.map((group) => {
                const targetY = (group.level - minLevel) * spacing
                return (
                  <FloorPlane
                    key={group.level}
                    group={group}
                    footprintShape={shape}
                    footprintWidth={width}
                    footprintDepth={depth}
                    targetY={targetY}
                    selectedRoomId={selectedRoomId}
                    roomLookup={roomLookup}
                    theme={theme}
                    onPickRoom={onPickRoom}
                  />
                )
              })}
            </group>
          </Bounds>

          {/* Płaszczyzna ziemi pod budynkiem — odbiera shadow. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -2, 0]}
            receiveShadow
          >
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial
              color={theme === 'dark' ? '#040714' : '#aabdd2'}
              roughness={1}
              metalness={0}
              transparent
              opacity={0.5}
            />
          </mesh>
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={isMobile ? 15 : 10}
          maxDistance={isMobile ? 260 : 200}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, ((floorGroups.length - 1) * spacing) / 2, 0]}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          enablePan={!isMobile /* na mobile pan często konfliktuje z scrollem */}
        />
      </Canvas>

      {/* Footer hint — różne wskazówki na mobile vs desktop */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur-md whitespace-nowrap">
        {isMobile
          ? '1 palec — obrót · 2 palce — zoom'
          : 'Lewy klik + drag — obrót · prawy klik — pan · scroll — zoom'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Fallback: WebGL niewspierany lub brak danych
// ─────────────────────────────────────────────────────────────────────

function FallbackList({
  rooms,
  floorGroups,
  selectedRoomId,
  onPickRoom,
  reason,
}: {
  rooms: Room[]
  floorGroups: Array<{ level: number; rooms: Array<{ id: string; code: string; capacity: number | null }> }>
  selectedRoomId: string | null
  onPickRoom: (roomId: string) => void
  reason: string
}) {
  return (
    <div className="h-full w-full overflow-y-auto bg-zinc-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
          {reason}
        </p>
        {floorGroups.length === 0 && rooms.length === 0 && (
          <p className="mt-6 text-sm text-white/65">
            Brak sal w bazie dla tego budynku. Sprawdź czy migracja Supabase z seedem sal
            (<span className="font-mono">20260616100000_uj_buildings_rooms.sql</span>) została
            zaaplikowana.
          </p>
        )}
        <div className="mt-6 space-y-5">
          {floorGroups.map((g) => (
            <section key={g.level}>
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] font-bold text-brand-gold-bright">
                {g.level === 0 ? 'Parter' : g.level > 0 ? `${g.level}. piętro` : `Piwnica ${g.level}`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {g.rooms.map((r) => {
                  const isSelected = selectedRoomId === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onPickRoom(r.id)}
                      className={`text-left rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-brand-gold-bright bg-brand-gold/15 text-brand-gold-bright'
                          : 'border-white/15 bg-white/4 text-white/85 hover:bg-white/9 hover:border-white/30'
                      }`}
                    >
                      <span className="block truncate font-mono text-[11px] opacity-70">
                        {r.code}
                      </span>
                      {r.capacity !== null && (
                        <span className="block truncate text-[10px] opacity-60 mt-0.5">
                          {r.capacity} miejsc
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// WebGL2 detection
// ─────────────────────────────────────────────────────────────────────

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    // r3f wymaga WebGL2 (przez Three.js r150+). Fallback do WebGL1 nie jest
    // wspierany przez nowsze Three.
    const gl = canvas.getContext('webgl2')
    return Boolean(gl)
  } catch {
    return false
  }
}
