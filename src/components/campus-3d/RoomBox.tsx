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

// Paleta — UJ brand only (warm zinc + gold), no blue/sky/slate-navy.
//   Aula     = bursztyn-gold (ciepły, "ważniejszy")
//   Lab      = przygaszony warm zinc (na brand-grayscale, nie cool slate)
//   Standard = brand-gold-bright (#e8c84a, UJ accent)
const PALETTE = {
  aula:     { idle: '#f59e0b', hover: '#fbbf24', selected: '#fde68a' },
  lab:      { idle: '#71717a', hover: '#a1a1aa', selected: '#d4d4d8' },
  standard: { idle: '#e8c84a', hover: '#f4d96b', selected: '#fde68a' },
} as const

const EMISSIVE_BASE = new THREE.Color('#27272a')
const EMISSIVE_SELECTED = new THREE.Color('#fde68a')

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
          roughness={0.55}
          metalness={0.05}
          emissive={EMISSIVE_BASE}
          emissiveIntensity={0}
          transparent
          opacity={0.95}
        />
        {/* Edges — wyraźne kontury "ścian" sali. W dark scene używamy
            warm cream/gold zamiast navy (`#0f172a` zlewało się z tłem),
            żeby boxy nie znikały. */}
        <Edges
          threshold={15}
          color={isSelected ? '#fde68a' : hovered ? '#fef9c3' : '#fbbf24'}
          lineWidth={isSelected ? 2.5 : 1.5}
        />
      </mesh>

      {/* HTML label — kod sali. `distanceFactor` wyższy = label większy
          (formula: scale = distanceFactor / distance). Wcześniej `20`
          dawało mikroskopijne labelki przy `<Bounds fit>` które ustawia
          kamerę 60-120m od budynku. Bump do 60 + większy font. */}
      <Html
        position={[0, layout.height / 2 + 0.25, 0]}
        center
        distanceFactor={60}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`select-none rounded-md border px-2 py-1 text-center transition-all ${
            isSelected
              ? 'border-brand-gold-bright bg-black/95 text-brand-gold-bright shadow-lg'
              : hovered
              ? 'border-brand-gold/75 bg-black/90 text-white'
              : layout.kind === 'aula'
              ? 'border-amber-400/80 bg-black/85 text-amber-100'
              : 'border-white/25 bg-black/80 text-white'
          }`}
          style={{
            fontSize: isSelected ? 16 : 14,
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
                marginLeft: 5,
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.85,
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
                  fontSize: 12,
                  fontWeight: 500,
                  marginTop: 3,
                  opacity: 0.9,
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
