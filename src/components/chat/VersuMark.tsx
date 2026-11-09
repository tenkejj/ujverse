/** Pixel-art Versuś. Every activity has a short animation and a static fallback. */
import { useSyncExternalStore } from 'react'
import {
  getUserPreferences,
  subscribePreferences,
} from '../../lib/userPreferences'

const readReducedMotion = () => getUserPreferences().reducedMotion
const serverReducedMotion = () => true

export type VersuMarkVariant = 'brand' | 'onAccent'
export type VersuActivity =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'answering'
  | 'success'
  | 'error'

type Props = {
  size: number
  className?: string
  variant?: VersuMarkVariant
  activity?: VersuActivity
  /** Stable request id replays a one-shot animation for each new conversation turn. */
  replayKey?: string
}

export default function VersuMark({
  size,
  className = '',
  variant = 'brand',
  activity = 'idle',
  replayKey,
}: Props) {
  const reducedMotion = useSyncExternalStore(
    subscribePreferences,
    readReducedMotion,
    serverReducedMotion,
  )
  // Small avatars use a face crop; the full pose keeps gestures readable.
  const asset = size < 72 ? `face-${activity}` : activity
  const source = `/versus/${asset}`
  const replayQuery = replayKey ? `?turn=${encodeURIComponent(replayKey)}` : ''

  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      data-activity={activity}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <picture
        key={`${asset}:${replayKey ?? ''}`}
        className="block h-full w-full"
      >
        <source
          media={reducedMotion ? 'all' : '(prefers-reduced-motion: reduce)'}
          srcSet={`${source}.png`}
        />
        <source type="image/webp" srcSet={`${source}.webp${replayQuery}`} />
        <img
          src={reducedMotion ? `${source}.png` : `${source}.gif${replayQuery}`}
          alt=""
          width={size}
          height={size}
          draggable={false}
          decoding="async"
          className="h-full w-full object-contain object-center"
          style={{ imageRendering: 'pixelated' }}
        />
      </picture>
    </span>
  )
}
