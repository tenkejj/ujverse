import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '../../services/SaleFinderService'
import type { RoomBoxLayout } from '../../services/Campus3DService'

/**
 * RoomBox — pojedyncza sala renderowana jako prosty box w widoku exploded.
 *
 * Stylowanie:
 *   - idle: półprzezroczyste gold (z `MeshStandardMaterial`)
 *   - hover: pełna saturacja gold, slight scale-up animacja
 *   - selected: highlighted (emissive), label zawsze widoczny
 *
 * Etykieta:
 *   - default: małe (HTML overlay) z kodem sali (`r.code`).
 *   - selected/hover: bigger, z `display_name` jeśli różni się od kodu.
 *
 * Animacja: lerp scale + emissive via `useFrame`. Bez @react-spring żeby
 * nie dorzucać kolejnej zależności.
 */

type Props = {
  layout: RoomBoxLayout
  room: Room
  isSelected: boolean
  onClick: () => void
}

// Paleta kolorów per `kind` — wizualne odróżnienie auli od zwykłych sal.
// Aula = bursztynowy (cieplejszy, "ważniejszy"), standard = złoty (UJ accent).
const PALETTE = {
  aula:     { idle: '#f59e0b', hover: '#fbbf24', selected: '#fcd34d' },
  lab:      { idle: '#60a5fa', hover: '#93c5fd', selected: '#bfdbfe' },
  standard: { idle: '#e8c84a', hover: '#f4d96b', selected: '#fde68a' },
} as const

const EMISSIVE_BASE = new THREE.Color('#1e293b')
const EMISSIVE_SELECTED = new THREE.Color('#facc15')

export default function RoomBox({ layout, room, isSelected, onClick }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const [hovered, setHovered] = useState(false)

  const palette = PALETTE[layout.kind] ?? PALETTE.standard

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    const target = isSelected ? 1.15 : hovered ? 1.07 : 1
    const speed = Math.min(1, delta * 8)
    const cur = meshRef.current.scale.x
    const next = cur + (target - cur) * speed
    meshRef.current.scale.setScalar(next)

    const eTarget = isSelected ? 1.0 : hovered ? 0.3 : 0
    const eCur = matRef.current.emissiveIntensity
    matRef.current.emissiveIntensity = eCur + (eTarget - eCur) * speed

    const colorHex = isSelected ? palette.selected : hovered ? palette.hover : palette.idle
    matRef.current.color.set(colorHex)
    matRef.current.emissive.copy(isSelected ? EMISSIVE_SELECTED : EMISSIVE_BASE)
  })

  return (
    <group position={[layout.x, layout.height / 2, layout.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[layout.width, layout.height, layout.depth]} />
        <meshStandardMaterial
          ref={matRef}
          color={palette.idle}
          roughness={0.6}
          metalness={0.1}
          emissive={EMISSIVE_BASE}
          emissiveIntensity={0}
          transparent
          opacity={0.88}
        />
        {/* Edges — wyraźne kontury "ścian" sali. Bez nich boxy zlewają
            się w jedno z sąsiadami przy ścisłym packingu. */}
        <Edges
          threshold={15}
          color={isSelected ? '#fde68a' : hovered ? '#fef9c3' : '#0f172a'}
          lineWidth={isSelected ? 2 : 1}
        />
      </mesh>

      {/* HTML label — kod sali. Zawsze widoczny, gdy selected/hover
          bigger + display_name. */}
      <Html
        position={[0, layout.height / 2 + 0.25, 0]}
        center
        distanceFactor={20}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`select-none rounded-md border px-1.5 py-0.5 text-center transition-all ${
            isSelected
              ? 'border-brand-gold-bright bg-black/90 text-brand-gold-bright shadow-lg'
              : hovered
              ? 'border-brand-gold/65 bg-black/80 text-white'
              : layout.kind === 'aula'
              ? 'border-amber-400/70 bg-black/70 text-amber-100'
              : 'border-white/15 bg-black/65 text-white/85'
          }`}
          style={{
            fontSize: isSelected ? 12 : 10,
            fontWeight: 800,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}
        >
          {room.code}
          {layout.kind === 'aula' && room.capacity && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 9,
                fontWeight: 600,
                opacity: 0.8,
              }}
            >
              · {room.capacity} miejsc
            </span>
          )}
          {(isSelected || hovered) &&
            room.display_name &&
            room.display_name !== `Sala ${room.code}` && (
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  marginTop: 2,
                  opacity: 0.85,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                }}
              >
                {room.display_name}
              </div>
            )}
        </div>
      </Html>
    </group>
  )
}
