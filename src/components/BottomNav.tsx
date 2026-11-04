import { AlarmClock, CalendarDays, Home, Megaphone, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { useScrollY } from '../hooks/useScrollY'
import { BOTTOM_NAV_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'
import { navTargetForView, type NavIcon, type PrimaryNavTarget } from './nav/navModel'

type Props = {
  /** Efektywny widok aplikacji — podświetlenie wylicza `navTargetForView`. */
  activeView: string
  onNavigate: (target: PrimaryNavTarget) => void
}

const TABS_LEFT: ReadonlyArray<{ target: PrimaryNavTarget; label: string; icon: NavIcon }> = [
  { target: 'home', label: 'Start', icon: Home },
  { target: 'komunikaty', label: 'Komunikaty', icon: Megaphone },
]
const TABS_RIGHT: ReadonlyArray<{ target: PrimaryNavTarget; label: string; icon: NavIcon }> = [
  { target: 'rejestracje', label: 'Rejestracje', icon: AlarmClock },
  { target: 'wydarzenia', label: 'Wydarzenia', icon: CalendarDays },
]

/**
 * Dolny pasek nawigacji (`<md`) — układ 2 + wyszukiwarka + 2:
 * `Start` · `Komunikaty` · `Szukaj` · `Rejestracje` · `Wydarzenia`.
 * Niezbędnik, konto i społeczność są w `MobileDrawer` (burger w nagłówku).
 */
export default function BottomNav({ activeView, onNavigate }: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > BOTTOM_NAV_MOBILE.scrollThreshold
  const active = navTargetForView(activeView)

  const renderTab = ({ target, label, icon: Icon }: { target: PrimaryNavTarget; label: string; icon: NavIcon }) => {
    const isActive = active === target
    return (
      <motion.button
        key={target}
        type="button"
        onClick={() => onNavigate(target)}
        whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
        className={`${BOTTOM_NAV_MOBILE.iconButtonBaseClass} ${
          isActive ? BOTTOM_NAV_MOBILE.iconButtonActiveClass : BOTTOM_NAV_MOBILE.iconButtonInactiveClass
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon
          size={ICONS_MOBILE.bottomNavIconSize}
          strokeWidth={isActive ? ICONS_MOBILE.bottomNavActiveStrokeWidth : ICONS_MOBILE.bottomNavInactiveStrokeWidth}
          className="shrink-0"
          aria-hidden
        />
        <span
          className={`${BOTTOM_NAV_MOBILE.iconButtonLabelClass} ${
            isActive ? BOTTOM_NAV_MOBILE.iconButtonLabelActiveClass : BOTTOM_NAV_MOBILE.iconButtonLabelInactiveClass
          }`}
        >
          {label}
        </span>
      </motion.button>
    )
  }

  const searchActive = active === 'szukaj'

  return (
    <nav
      className={`${BOTTOM_NAV_MOBILE.navBaseClass} ${
        isScrolled ? BOTTOM_NAV_MOBILE.navScrolledClass : BOTTOM_NAV_MOBILE.navDefaultClass
      }`}
      style={{ paddingBottom: BOTTOM_NAV_MOBILE.safeAreaBottomInset }}
      aria-label="Pasek nawigacji"
    >
      <div className={BOTTOM_NAV_MOBILE.rowClass}>
        {TABS_LEFT.map(renderTab)}

        <div className={BOTTOM_NAV_MOBILE.composeWrapperClass}>
          <motion.button
            type="button"
            onClick={() => onNavigate('szukaj')}
            whileHover={BOTTOM_NAV_MOBILE.motion.composeHover}
            whileTap={BOTTOM_NAV_MOBILE.motion.composeTap}
            transition={BOTTOM_NAV_MOBILE.motion.composeTransition}
            className={`${BOTTOM_NAV_MOBILE.composeButtonClass} ${searchActive ? 'ring-2 ring-offset-2 ring-brand-ink/40 ring-offset-bg-app dark:ring-brand-gold-bright/60' : ''}`}
            aria-label="Szukaj"
            aria-current={searchActive ? 'page' : undefined}
          >
            <Search size={24} strokeWidth={2.25} aria-hidden />
          </motion.button>
        </div>

        {TABS_RIGHT.map(renderTab)}
      </div>
    </nav>
  )
}
