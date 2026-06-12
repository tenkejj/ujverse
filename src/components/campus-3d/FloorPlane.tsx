import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '../../services/SaleFinderService'
import { layoutFloor, type FloorGroup } from '../../services/Campus3DService'
import RoomBox from './RoomBox'

/**
 * FloorPlane — pojedyncze piętro budynku w widoku exploded.
 *
 * Renderuje:
 *   1. "Deskę" piętra (footprint extrusion ~40cm) — daje wrażenie
 *      stosu pięter, plus contact surface dla shadow.
 *   2. Outline (linia po obwodzie) — wzmacnia kontur pięter w wide view.
 *   3. Etykietę piętra (`level`) z boku — sprite zawsze obrócony do kamery.
 *   4. Korytarze — ciemniejsze pasy na podłodze (między rzędami sal).
 *   5. RoomBoxes z `uj_rooms` na tym piętrze (lub puste piętro gdy brak
 *      sal w bazie — pokazuje że budynek faktycznie ma to piętro).
 *
 * Animacja exploded:
 *   - Position Y jest animowana z `useFrame`: lerp do `targetY`.
 *   - `targetY` przychodzi z parent (ExplodedBuildingView) i zależy od
 *     `level * SPACING` w aktualnym trybie (compact vs exploded).
 */

const FLOOR_THICKNESS = 0.4
// Warm charcoal (zinc) zamiast navy slate — żeby cała scena nie była
// "blue tinted".
const FLOOR_COLOR_LIGHT = '#cbd5e1'
const FLOOR_COLOR_DARK = '#27272a' // zinc-800
const OUTLINE_COLOR_LIGHT = '#475569'
const OUTLINE_COLOR_DARK = '#fde68a'

// Korytarz — wąski pas na podłodze, ciemniejszy/jaśniejszy niż reszta
// piętra. Daje wrażenie "hallway" między salami.
const CORRIDOR_COLOR_LIGHT = '#94a3b8'
const CORRIDOR_COLOR_DARK = '#18181b' // zinc-900

type Props = {
  group: FloorGroup
  /** Outer-ring footprint w projection coords {x, z}. */
  footprintShape: THREE.Shape | null
  footprintWidth: number
  footprintDepth: number
  targetY: number
  selectedRoomId: string | null
  roomLookup: Map<string, Room>
  theme: 'light' | 'dark'
  onPickRoom: (roomId: string) => void
  /**
   * Jeśli `true`, piętro jest "puste" (brak sal w bazie) — pokazujemy
   * tylko slab + outline + label. Wykorzystywane gdy `building.levels`
   * > liczba pięter z sali w `uj_rooms`.
   */
  emptyFloor?: boolean
}

export default function FloorPlane({
  group,
  footprintShape,
  footprintWidth,
  footprintDepth,
  targetY,
  selectedRoomId,
  roomLookup,
  theme,
  onPickRoom,
  emptyFloor = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)

  // Lerp Y towards target (smooth exploded animation).
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const cur = groupRef.current.position.y
    const speed = Math.min(1, delta * 4)
    groupRef.current.position.y = cur + (targetY - cur) * speed
  })

  // Layout: sale + korytarze. Puste piętro nie ma żadnego layoutu.
  const { rooms: boxLayouts, corridors } = useMemo(
    () =>
      emptyFloor
        ? { rooms: [], corridors: [] }
        : layoutFloor(group.rooms, footprintWidth, footprintDepth),
    [emptyFloor, group.rooms, footprintWidth, footprintDepth],
  )

  // Geometria deski piętra — z `Shape` jeśli mamy, fallback to prostokąt.
  const slabGeometry = useMemo(() => {
    if (footprintShape) {
      return new THREE.ExtrudeGeometry(footprintShape, {
        depth: FLOOR_THICKNESS,
        bevelEnabled: false,
      })
    }
    return new THREE.BoxGeometry(footprintWidth, FLOOR_THICKNESS, footprintDepth)
  }, [footprintShape, footprintWidth, footprintDepth])

  // Outline (LineSegments) wokół footprintu — TYLKO gdy mamy Shape.
  const outlineGeometry = useMemo(() => {
    if (!footprintShape) return null
    const points = footprintShape.getPoints(64)
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, 0, p.y)),
    )
    return geo
  }, [footprintShape])

  return (
    <group ref={groupRef} position={[0, targetY, 0]}>
      {/* Deska piętra. Jeśli z `Shape` — geometry jest w XY plane,
          obracamy do XZ (Y-up). */}
      <mesh
        geometry={slabGeometry}
        rotation={footprintShape ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
        position={footprintShape ? [0, -FLOOR_THICKNESS, 0] : [0, -FLOOR_THICKNESS / 2, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={theme === 'dark' ? FLOOR_COLOR_DARK : FLOOR_COLOR_LIGHT}
          roughness={0.85}
          metalness={0.05}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Outline */}
      {outlineGeometry && (
        <lineLoop>
          <primitive object={outlineGeometry} attach="geometry" />
          <lineBasicMaterial
            color={theme === 'dark' ? OUTLINE_COLOR_DARK : OUTLINE_COLOR_LIGHT}
            opacity={0.85}
            transparent
          />
        </lineLoop>
      )}

      {/* Etykieta piętra — z boku, na maksymalnym X. Większy font żeby
          była czytelna z dystansu (Bounds.fit zwykle ustawia kamerę
          dość daleko). */}
      <Text
        position={[footprintWidth / 2 + 2, 1.8, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={2.4}
        color={theme === 'dark' ? '#fde68a' : '#0f172a'}
        outlineColor={theme === 'dark' ? '#09090b' : '#ffffff'}
        outlineWidth={0.08}
        anchorX="left"
        anchorY="middle"
      >
        {labelForLevel(group.level)}
      </Text>

      {/* Korytarze — cienkie pasy na podłodze (tuż nad slabem, żeby się
          nie z-fightowały). `side: DoubleSide` żeby były widoczne też
          od dołu w trybie wide camera. Renderowane TYLKO gdy nie jest
          to puste piętro i mamy sale. */}
      {corridors.map((c, i) => (
        <group key={`corridor-${i}`} position={[c.x, 0.05, c.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[c.width, c.depth]} />
            <meshStandardMaterial
              color={theme === 'dark' ? CORRIDOR_COLOR_DARK : CORRIDOR_COLOR_LIGHT}
              roughness={0.95}
              metalness={0.0}
              side={THREE.DoubleSide}
              transparent
              opacity={theme === 'dark' ? 0.92 : 0.85}
            />
          </mesh>
          {/* Centralny pasek "linii środkowej" — wąski jasny pas wzdłuż
              dłuższej osi korytarza. Daje silne wizualne wrażenie "hallway". */}
          <mesh
            position={[0, 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry
              args={
                c.depth > c.width
                  ? [Math.max(0.15, c.width * 0.12), c.depth - 0.3]
                  : [c.width - 0.3, Math.max(0.15, c.depth * 0.12)]
              }
            />
            <meshBasicMaterial
              color={theme === 'dark' ? '#fde68a' : '#facc15'}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* Pusty floor marker — gdy `emptyFloor` rysujemy małą etykietkę
          "Brak danych" w środku piętra, żeby user wiedział czemu jest pusto. */}
      {emptyFloor && (
        <Text
          position={[0, 0.6, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.6}
          color={theme === 'dark' ? '#a1a1aa' : '#52525b'}
          outlineColor={theme === 'dark' ? '#09090b' : '#ffffff'}
          outlineWidth={0.06}
          anchorX="center"
          anchorY="middle"
        >
          (brak danych o salach)
        </Text>
      )}

      {/* Sale */}
      {boxLayouts.map((layout) => {
        const room = roomLookup.get(layout.roomId)
        if (!room) return null
        return (
          <RoomBox
            key={layout.roomId}
            layout={layout}
            room={room}
            isSelected={selectedRoomId === layout.roomId}
            onClick={() => onPickRoom(layout.roomId)}
          />
        )
      })}
    </group>
  )
}

function labelForLevel(level: number): string {
  if (level === 0) return 'Parter'
  if (level > 0) return `${level}. p.`
  return `P${level}`
}
