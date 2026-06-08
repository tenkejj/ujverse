import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../ThemeContext'

/**
 * AuthShell — spójne tło dla ekranów Login / Reset / przyszłych onboardingów.
 *
 * Trzyma się tokenów z `theme.ts`:
 *  - light: kość słoniowa (`bg-bg-app`) + delikatne navy auroras
 *  - dark : czarny + ciepłe gold auroras (zamiast amber blobów)
 *
 * Karta to standardowy glass — `border-zinc-200/80 / dark:border-white/10`,
 * `bg-white/80 / dark:bg-zinc-950/60`, `backdrop-blur-xl`.
 */
type Props = {
  children: ReactNode
  /** Maksymalna szerokość karty (default `max-w-md`). Reset hasła używa szerszej. */
  maxWidthClass?: string
}

export default function AuthShell({ children, maxWidthClass = 'max-w-md' }: Props) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-start overflow-hidden bg-bg-app pt-[6vh] pb-12 px-4 sm:pt-[8vh]">
      {/* Aurora — navy w light, gold w dark, bez „amber blob" z poprzedniej wersji */}
      <div
        aria-hidden
        className={
          'pointer-events-none absolute -left-1/4 top-1/4 ' +
          'h-[min(50vw,28rem)] w-[min(50vw,28rem)] rounded-full blur-[110px] ' +
          'bg-[#1e293b]/6 dark:bg-[#c9a227]/15'
        }
      />
      <div
        aria-hidden
        className={
          'pointer-events-none absolute -right-1/5 bottom-1/4 ' +
          'h-[min(45vw,24rem)] w-[min(45vw,24rem)] rounded-full blur-[110px] ' +
          'bg-[#1e2a4f]/5 dark:bg-[#a48955]/20'
        }
      />
      <div
        aria-hidden
        className={
          'pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 ' +
          'rounded-full blur-3xl bg-[#1e293b]/4 dark:bg-[#e8c84a]/10'
        }
      />

      {/* Theme toggle — żeby user mógł przełączyć motyw od razu na auth */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
        className={
          'absolute right-4 top-4 z-20 inline-flex items-center justify-center rounded-full ' +
          'border border-zinc-200/80 bg-white/70 p-2.5 text-[#1e293b] backdrop-blur-md ' +
          'transition-colors hover:bg-white ' +
          'dark:border-white/10 dark:bg-white/4 dark:text-white/80 dark:hover:bg-white/10'
        }
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>

      <motion.div
        className={`relative z-10 flex w-full ${maxWidthClass} flex-col items-center`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        {/*
          Logo wyrenderowane jako mask-image: kolorowy <div> przyjmuje kształt
          PNG-a, ignorując jego tło i pusty margines (bez tej sztuczki przy h-48
          w dark mode pojawiał się ciemny prostokąt z bounding boxa PNG-a).
          Kolor jest świadomy motywu — `uj-deep-gold` w light, `brand-gold-bright`
          w dark — spójnie z resztą identyfikacji UJverse.
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
            'mb-6 h-48 w-64 shrink-0 sm:h-56 sm:w-72 md:h-64 md:w-80 ' +
            'bg-uj-deep-gold dark:bg-brand-gold-bright ' +
            'drop-shadow-[0_0_32px_rgba(196,154,108,0.35)] ' +
            'dark:drop-shadow-[0_0_42px_rgba(232,200,74,0.45)]'
          }
        />

        <div
          className={
            'w-full rounded-3xl border ' +
            'border-zinc-200/80 bg-white/80 ' +
            'dark:border-white/10 dark:bg-zinc-950/60 ' +
            'backdrop-blur-xl ' +
            'shadow-[0_24px_64px_-32px_rgba(15,23,42,0.18)] ' +
            'dark:shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] ' +
            'p-7 sm:p-8'
          }
        >
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-white/40">
          UJverse · nieoficjalna platforma społeczności UJ
        </p>
      </motion.div>
    </div>
  )
}
