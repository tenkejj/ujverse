/** Shared mascot wrapper. Animation and reduced motion live in VersuMark. */
import VersuMark, {
  type VersuActivity,
  type VersuMarkVariant,
} from './VersuMark'

export type AnimatedBotIntensity = 'idle' | 'active' | 'wave' | 'pulse'

type Props = {
  size?: number
  /** @deprecated Ignorowane — zachowane dla kompatybilności call-site. */
  strokeWidth?: number
  className?: string
  intensity?: AnimatedBotIntensity
  variant?: VersuMarkVariant
  activity?: VersuActivity
  replayKey?: string
}

export default function AnimatedBot({
  size = 16,
  className = '',
  intensity = 'idle',
  variant = 'brand',
  activity,
  replayKey,
}: Props) {
  const currentActivity =
    activity ??
    (intensity === 'wave'
      ? 'greeting'
      : intensity === 'active'
        ? 'thinking'
        : 'idle')
  return (
    <span
      aria-hidden="true"
      data-activity={currentActivity}
      className={`inline-flex shrink-0 ${className}`}
    >
      <VersuMark
        size={size}
        variant={variant}
        activity={currentActivity}
        replayKey={replayKey}
      />
    </span>
  )
}
