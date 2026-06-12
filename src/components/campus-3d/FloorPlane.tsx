import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '../../services/SaleFinderService'
import { layoutRoomBoxes, type FloorGroup } from '../../services/Campus3DService'
import RoomBox from './RoomBox'

/**
 * FloorPlane — pojedyncze piętro budynku w widoku exploded.
 *
 * Renderuje:
 *   1. Cienką "deskę" piętra (footprint extrusion 30cm) — daje wrażenie
 *      stosu pięter, plus contact surface dla shadow.
 *   2. Outline (linia po obwodzie) — wzmacnia kontur pięter w wide view.
 *   3. Etykietę piętra (`level`) z boku — sprite zawsze obrócony do kamery.
 *   4. RoomBoxes z `uj_rooms` na tym piętrze.
 *
 * Animacja exploded:
 *   - Position Y jest animowana z `useFrame`: lerp do `targetY`.
 *   - `targetY` przychodzi z parent (ExplodedBuildingView) i zależy od
 *     `level * SPACING` w aktualnym trybie (compact vs exploded).
 */

const FLOOR_THICKNESS = 0.3
const FLOOR_COLOR_LIGHT = '#cbd5e1'
const FLOOR_COLOR_DARK = '#1e293b'
const OUTLINE_COLOR_LIGHT = '#475569'
const OUTLINE_COLOR_DARK = '#fde68a'

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
}: Props) {
  const groupRef = useRef<THREE.Group>(null)

  // Lerp Y towards target (smooth exploded animation).
  useFrame((_, delta) => {
    if (!groupRef.current) return
    const cur = groupRef.current.position.y
    const speed = Math.min(1, delta * 4)
    groupRef.current.position.y = cur + (targetY - cur) * speed
  })

  // Layouts per pokój — w sync z footprint dimensions.
  const boxLayouts = useMemo(
    () => layoutRoomBoxes(group.rooms, footprintWidth, footprintDepth),
    [group.rooms, footprintWidth, footprintDepth],
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

      {/* Etykieta piętra — z boku, na maksymalnym X. */}
      <Text
        position={[footprintWidth / 2 + 1.5, 1.2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={1.4}
        color={theme === 'dark' ? '#fde68a' : '#0f172a'}
        outlineColor={theme === 'dark' ? '#0b1226' : '#ffffff'}
        outlineWidth={0.05}
        anchorX="left"
        anchorY="middle"
      >
        {labelForLevel(group.level)}
      </Text>

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
