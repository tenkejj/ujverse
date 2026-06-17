import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../ThemeContext'
import { AUTH_MOBILE } from '../../styles/mobile-theme'

const LOGO_MASK_STYLE = {
  maskImage: `url(${AUTH_MOBILE.logo.assetPath})`,
  WebkitMaskImage: `url(${AUTH_MOBILE.logo.assetPath})`,
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
} as const

/**
 * AuthShell — spotlight + logo tuż nad treścią formularza (logo-auth.png).
 */
type Props = {
  children: ReactNode
}

export default function AuthShell({ children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const reducedMotion = useReducedMotion()

  return (
    <div className={AUTH_MOBILE.shell.pageClass}>
      <div className={AUTH_MOBILE.mesh.wrapperClass} aria-hidden>
        <div className={AUTH_MOBILE.mesh.baseLightClass} />
        <div className={AUTH_MOBILE.mesh.baseDarkClass} />
        <div className={AUTH_MOBILE.mesh.ambientLightClass} />
        <div className={AUTH_MOBILE.mesh.floorWashLightClass} />
        <div className={AUTH_MOBILE.spotlight.orbPrimaryLightClass} />
        <div className={AUTH_MOBILE.spotlight.orbPrimaryDarkClass} />
        <div className={AUTH_MOBILE.spotlight.orbGoldLightClass} />
        <div className={AUTH_MOBILE.spotlight.orbGoldDarkClass} />
        <div className={AUTH_MOBILE.spotlight.orbNavyLightClass} />
        <div className={AUTH_MOBILE.mesh.vignetteLightClass} />
        <div className={AUTH_MOBILE.mesh.vignetteDarkClass} />
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
        className={
          'absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-20 ' +
          AUTH_MOBILE.shell.themeToggleClass +
          ' sm:right-4 sm:top-4'
        }
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>

      <motion.div
        className={AUTH_MOBILE.shell.columnClass}
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={AUTH_MOBILE.motion.entry}
      >
        <div
          aria-label="UJverse"
          role="img"
          style={LOGO_MASK_STYLE}
          className={AUTH_MOBILE.logo.markClass}
        />

        {children}

        <p className={AUTH_MOBILE.footer.primaryClass}>
          UJverse · nieoficjalna platforma społeczności UJ
        </p>
        <p className={AUTH_MOBILE.footer.secondaryClass}>
          Stworzone przez Franciszek Dranka
        </p>
      </motion.div>
    </div>
  )
}
