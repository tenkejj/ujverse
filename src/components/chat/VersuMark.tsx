/** Pixel-art Versuś. Every activity has a short animation and a static fallback. */
import { useSyncExternalStore } from 'react'
import {
  getUserPreferences,
  subscribePreferences,
} from '../../lib/userPreferences'
import '../../styles/versus-chat.css'

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
  /** Force the face crop or full pose; small marks use portraits by default. */
  portrait?: boolean
  /** Stable request id replays a one-shot animation for each new conversation turn. */
  replayKey?: string
}

export default function VersuMark({
  size,
  className = '',
  variant = 'brand',
  activity = 'idle',
  portrait,
  replayKey,
}: Props) {
  const reducedMotion = useSyncExternalStore(
    subscribePreferences,
    readReducedMotion,
    serverReducedMotion,
  )
  // Small avatars use a face crop; the full pose keeps gestures readable.
  const isPortrait = portrait ?? size < 72
  const asset = isPortrait ? `face-${activity}` : activity
  const source = `/versus/${asset}`
  const replayQuery = replayKey ? `?turn=${encodeURIComponent(replayKey)}` : ''

  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      data-activity={activity}
      data-portrait={isPortrait}
      className={`versu-mark relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: `var(--versu-mark-size, ${size}px)`,
        height: `var(--versu-mark-size, ${size}px)`,
      }}
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
