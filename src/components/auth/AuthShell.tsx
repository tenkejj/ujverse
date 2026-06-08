import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../ThemeContext'

/**
 * AuthShell — spójne tło dla ekranów Login / Reset / przyszłych onboardingów.
 *
 * Tło: statyczne `bg-bg-app` (kość słoniowa light / czarny dark) — bez aurorek
 * i bez `backdrop-blur` na warstwie tła. Mobile-first sizing dla logo i karty.
 *
 * Karta: lekko przezroczysta z subtelnym blur — żeby zachować spójny vibe
 * z resztą apki, ale bez kosztownych efektów na całym ekranie.
 */
type Props = {
  children: ReactNode
  /** Maksymalna szerokość karty (default `max-w-md`). Reset hasła używa szerszej. */
  maxWidthClass?: string
}

export default function AuthShell({ children, maxWidthClass = 'max-w-md' }: Props) {
  const { theme, toggleTheme } = useTheme()
  const reducedMotion = useReducedMotion()

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-start bg-bg-app pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),2rem)] px-4 sm:pt-[6vh]">
      {/* Theme toggle — szklana pigułka, ten sam materiał co karta */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
        className={
          'absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-20 ' +
          'inline-flex items-center justify-center rounded-full p-2.5 ' +
          'border border-white/60 bg-white/50 text-[#1e293b] ' +
          'backdrop-blur-xl backdrop-saturate-150 ' +
          'ring-1 ring-inset ring-white/40 ' +
          'shadow-[0_4px_16px_-6px_rgba(15,23,42,0.18)] ' +
          'transition-colors hover:bg-white/70 ' +
          'dark:border-white/10 dark:bg-white/5 dark:text-white/85 ' +
          'dark:ring-white/10 dark:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.4)] ' +
          'dark:hover:bg-white/10 sm:right-4 sm:top-4'
        }
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>

      <motion.div
        className={`relative z-10 flex w-full ${maxWidthClass} flex-col items-center`}
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/*
          Logo: mask-image na PNG, kolor sterowany tokenem `logo-navy` w light /
          `brand-gold-bright` w dark — identycznie jak w Header.
          Mobile-first sizing — logo nie wypycha karty poza fold.
        */}
        <div
          aria-label="UJverse"
          role="img"
          style={{
            maskImage: 'url(/logo.png)',
            WebkitMaskImage: 'url(/logo.png)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
          className={
            'mb-4 h-32 w-44 shrink-0 ' +
            'sm:mb-6 sm:h-44 sm:w-60 ' +
            'md:h-56 md:w-72 ' +
            'bg-logo-navy dark:bg-brand-gold-bright ' +
            'transition-colors duration-150 ease-in-out'
          }
        />

        {/*
          Karta auth — frosted glass:
          - bg-white/55 (light) / bg-zinc-950/55 (dark) — średnia transparentność,
            kolor `bg-bg-app` przebija się subtelnie
          - backdrop-blur-2xl + saturate-150 — gęsty blur w stylu iOS materials
          - ring-inset ring-white/50 — wewnętrzny "edge light"
          - top-highlight gradient (overlay) — biały odblask na górnej krawędzi
        */}
        <div
          className={
            'relative w-full overflow-hidden rounded-3xl border ' +
            'border-white/60 bg-white/55 ' +
            'dark:border-white/10 dark:bg-zinc-950/55 ' +
            'backdrop-blur-2xl backdrop-saturate-150 ' +
            'ring-1 ring-inset ring-white/50 dark:ring-white/8 ' +
            'shadow-[0_24px_70px_-28px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.6)] ' +
            'dark:shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] ' +
            'p-5 sm:p-7'
          }
        >
          <div
            aria-hidden
            className={
              'pointer-events-none absolute inset-x-0 top-0 h-28 ' +
              'bg-linear-to-b from-white/45 via-white/8 to-transparent ' +
              'dark:from-white/8 dark:via-white/2 dark:to-transparent'
            }
          />
          <div className="relative">{children}</div>
        </div>

        <p className="mt-5 text-center text-[11px] text-zinc-500 dark:text-white/40 sm:text-xs">
          UJverse · nieoficjalna platforma społeczności UJ
        </p>
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-white/30 sm:text-[11px]">
          Stworzone przez Franciszek Dranka
        </p>
      </motion.div>
    </div>
  )
}
