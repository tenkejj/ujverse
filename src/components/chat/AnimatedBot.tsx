/** Shared mascot wrapper. Animation and reduced motion live in VersuMark. */
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

export default function AnimatedBot({
  size = 16,
  className = '',
  intensity = 'idle',
  variant = 'brand',
}: Props) {
  return (
    <span
      aria-hidden="true"
      data-activity={intensity}
      className={`inline-flex shrink-0 ${className}`}
    >
      <VersuMark size={size} variant={variant} />
    </span>
  )
}
