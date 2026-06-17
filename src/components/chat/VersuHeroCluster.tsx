/**
 * `VersuHeroCluster` — sowa + spotlight (wspólna oś), używane w wyspie feedu
 * i empty state `/chat`.
 */

import { motion, useReducedMotion } from 'framer-motion'
import AnimatedBot from './AnimatedBot'

const SPOTLIGHT_CLS =
  'pointer-events-none absolute inset-0 rounded-full ' +
  'bg-[radial-gradient(circle,rgb(255_255_255/0.85)_0%,rgb(30_41_59/0.06)_50%,transparent_72%)] ' +
  'dark:bg-[radial-gradient(circle,rgb(201_162_57/0.28)_0%,rgb(201_162_57/0.1)_50%,transparent_72%)]'

type Props = {
  /** Rozmiar kontenera spotlightu (Tailwind, np. `size-32`). */
  containerClass?: string
  /** Rozmiar wrappera ikony (Tailwind, np. `size-14`). */
  iconWrapClass?: string
  /** Średnica sowy w px. */
  iconSize: number
  className?: string
}

export default function VersuHeroCluster({
  containerClass = 'size-32',
  iconWrapClass = 'size-14',
  iconSize,
  className = '',
}: Props) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${containerClass} ${className}`}
    >
      {reducedMotion ? (
        <div aria-hidden className={SPOTLIGHT_CLS} />
      ) : (
        <motion.div
          aria-hidden
          className={SPOTLIGHT_CLS}
          animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {!reducedMotion && (
        <>
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border border-logo-navy/12 dark:border-brand-gold-bright/15"
              animate={{ scale: [1, 1.55], opacity: [0.45, 0] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeOut',
                delay: i * 1.2,
              }}
            />
          ))}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-full bg-logo-navy/6 dark:bg-brand-gold-bright/8"
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      <span
        className={`relative z-10 flex items-center justify-center ${iconWrapClass}`}
      >
        <AnimatedBot size={iconSize} intensity="pulse" />
      </span>
    </div>
  )
}
