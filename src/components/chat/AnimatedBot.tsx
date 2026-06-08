/**
 * `AnimatedBot` — wspólny wrapper na lucide `<Bot>` z mikro-animacją
 * framer-motion. Używany wszędzie gdzie chat / asystent: wyspa, FAB,
 * sheet header, welcome states, typing indicator.
 *
 * Animacje:
 *  - `idle`   — subtelne, ciągłe (scale 1 → 1.08, rotate -3° → 3°, 2.8s loop).
 *    Pasuje do "spoczynkowych" miejsc: header wyspy, FAB, sheet header.
 *  - `active` — mocniejsze, szybsze (scale 1 → 1.15, rotate -5° → 5°, 1.4s loop).
 *    Pasuje do typing indicator (przyciąga wzrok do trwającej odpowiedzi).
 *  - `wave`   — gest powitania: 4 szybkie oscylacje rotate ±20° w pierwszych
 *    ~70% cyklu (jak prawdziwe machanie ręką), potem ~30% pauzy zanim
 *    powtórka. 2.6s pełny cykl. Niejednorodne timing keyframes przez
 *    `transition.times` — bez nich framer-motion rozłożyłby je równo i
 *    całość czytałaby się jak wolne, mechaniczne kołysanie. Dedykowane dla
 *    welcome / empty states (hub, MessageList); amplituda ±20° wymaga
 *    hero-rozmiaru (≥44px) i braku ramki, żeby ikona miała przestrzeń.
 *
 * Respektuje `prefers-reduced-motion` przez `useReducedMotion()`: w razie
 * preferencji użytkownika renderujemy statyczny `<Bot>` (zero animacji).
 *
 * Jedno źródło prawdy zamiast duplikowania `motion.span` w 5 miejscach
 * (ChatAssistant, ChatAssistantFab × 2, MessageList × 2, ChatHubView).
 */

import { Bot } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

export type AnimatedBotIntensity = 'idle' | 'active' | 'wave'

type Props = {
  size?: number
  strokeWidth?: number
  className?: string
  intensity?: AnimatedBotIntensity
}

const ANIMATIONS: Record<
  AnimatedBotIntensity,
  {
    scale: number[]
    rotate: number[]
    duration: number
    times?: number[]
  }
> = {
  idle: {
    scale: [1, 1.08, 1],
    rotate: [-3, 3, -3],
    duration: 2.8,
  },
  active: {
    scale: [1, 1.15, 1],
    rotate: [-5, 5, -5],
    duration: 1.4,
  },
  wave: {
    // 4 oscylacje +/- 20° upakowane w pierwszych 70% cyklu, potem pauza —
    // czyta się jako „cześć!" gest, a nie wolne kołysanie.
    scale: [1, 1.06, 1.06, 1.06, 1.06, 1, 1],
    rotate: [0, -20, 20, -20, 20, 0, 0],
    duration: 2.6,
    times: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 1],
  },
}

export default function AnimatedBot({
  size = 16,
  strokeWidth = 2,
  className = '',
  intensity = 'idle',
}: Props) {
  const reducedMotion = useReducedMotion()
  if (reducedMotion) {
    return <Bot size={size} strokeWidth={strokeWidth} className={className} />
  }

  const a = ANIMATIONS[intensity]
  return (
    <motion.span
      aria-hidden
      className={`inline-flex origin-center ${className}`}
      animate={{ scale: a.scale, rotate: a.rotate }}
      transition={{
        duration: a.duration,
        repeat: Infinity,
        ease: 'easeInOut',
        ...(a.times ? { times: a.times } : {}),
      }}
    >
      <Bot size={size} strokeWidth={strokeWidth} />
    </motion.span>
  )
}
