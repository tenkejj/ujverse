/**
 * `AnimatedBot` — wspólny wrapper na `VersuMark` z mikro-animacją
 * framer-motion. Używany wszędzie gdzie chat / asystent: wyspa, FAB,
 * sheet header, welcome states, typing indicator.
 *
 * `variant="onAccent"` — na wypełnionym FAB / headerze sheetu.
 *
 * Respektuje `prefers-reduced-motion` — wtedy statyczny `VersuMark`.
 */

import { motion, useReducedMotion } from 'framer-motion'
import VersuMark, { type VersuMarkVariant } from './VersuMark'

export type AnimatedBotIntensity = 'idle' | 'active' | 'wave' | 'pulse'

type Props = {
  size?: number
  /** @deprecated Ignorowane — zachowane dla kompatybilności call-site. */
  strokeWidth?: number
  className?: string
  intensity?: AnimatedBotIntensity
  variant?: VersuMarkVariant
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
    scale: [1, 1.06, 1.06, 1.06, 1.06, 1, 1],
    rotate: [0, -20, 20, -20, 20, 0, 0],
    duration: 2.6,
    times: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 1],
  },
  pulse: {
    scale: [1, 1.045, 1],
    rotate: [0, 0, 0],
    duration: 3.2,
  },
}

export default function AnimatedBot({
  size = 16,
  className = '',
  intensity = 'idle',
  variant = 'brand',
}: Props) {
  const reducedMotion = useReducedMotion()
  const mark = <VersuMark size={size} variant={variant} />

  if (reducedMotion) {
    return mark
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
      {mark}
    </motion.span>
  )
}
