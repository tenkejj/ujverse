import { Bell, ClipboardList, Home, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useScrollY } from '../hooks/useScrollY'
import { BOTTOM_NAV_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events' | 'mojPlan'

type Props = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  onOpenCompose: () => void
  onOpenNotifications: () => void
  /**
   * Skrót do `Mój Plan` (dawniej /dzis + /briefing). Trzymamy go w
   * bottom navie, bo to NAJCZĘŚCIEJ otwierany ekran w trakcie dnia
   * (alarmy, najbliższe zajęcia, briefingi). Bez niego pasek był
   * asymetryczny: 1 tab po lewej + FAB + 2 po prawej.
   */
  onNavigateToMojPlan: () => void
  /** Ilość nieprzeczytanych powiadomień — kropka/badge przy „Alerty". */
  unreadCount: number
}

function ComposePlusIcon() {
  return (
    <svg
      width={ICONS_MOBILE.composePlusIconSize}
      height={ICONS_MOBILE.composePlusIconSize}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="block shrink-0"
    >
      <line
        x1="12"
        y1="7.5"
        x2="12"
        y2="16.5"
        stroke="currentColor"
        strokeWidth={ICONS_MOBILE.composePlusIconStrokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="7.5"
        y1="12"
        x2="16.5"
        y2="12"
        stroke="currentColor"
        strokeWidth={ICONS_MOBILE.composePlusIconStrokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Dolny pasek nawigacji (`<md`). 5 slotów (układ 2 + FAB + 2):
 *  `Strona` · `Plan` · `+` · `Alerty` · `Profil`.
 * Pozostałe sekcje (Wydarzenia, Aula, Zniżki, USOS, Miejsca) trafiają
 * do `MobileDrawer` otwieranego burgerem w `Header.tsx`. Każdy tab ma
 * podpis tekstowy pod ikoną dla czytelności.
 */
export default function BottomNav({
  activeView,
  setActiveView,
  onOpenCompose,
  onOpenNotifications,
  onNavigateToMojPlan,
  unreadCount,
}: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > BOTTOM_NAV_MOBILE.scrollThreshold

  const tabClass = (isActive: boolean) =>
    `${BOTTOM_NAV_MOBILE.iconButtonBaseClass} ${
      isActive ? BOTTOM_NAV_MOBILE.iconButtonActiveClass : BOTTOM_NAV_MOBILE.iconButtonInactiveClass
    }`
  const labelClass = (isActive: boolean) =>
    `${BOTTOM_NAV_MOBILE.iconButtonLabelClass} ${
      isActive
        ? BOTTOM_NAV_MOBILE.iconButtonLabelActiveClass
        : BOTTOM_NAV_MOBILE.iconButtonLabelInactiveClass
    }`

  return (
    <nav
      className={`${BOTTOM_NAV_MOBILE.navBaseClass} ${
        isScrolled
          ? BOTTOM_NAV_MOBILE.navScrolledClass
          : BOTTOM_NAV_MOBILE.navDefaultClass
      }`}
      style={{ paddingBottom: BOTTOM_NAV_MOBILE.safeAreaBottomInset }}
      aria-label="Pasek nawigacji"
    >
      <div className={BOTTOM_NAV_MOBILE.rowClass}>
        <motion.button
          type="button"
          onClick={() => setActiveView('feed')}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={tabClass(activeView === 'feed')}
          aria-label="Strona główna"
        >
          <Home
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={
              activeView === 'feed'
                ? ICONS_MOBILE.bottomNavActiveStrokeWidth
                : ICONS_MOBILE.bottomNavInactiveStrokeWidth
            }
            className="shrink-0"
          />
          <span className={labelClass(activeView === 'feed')}>Strona</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={onNavigateToMojPlan}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={tabClass(activeView === 'mojPlan')}
          aria-label="Mój Plan"
        >
          <ClipboardList
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={
              activeView === 'mojPlan'
                ? ICONS_MOBILE.bottomNavActiveStrokeWidth
                : ICONS_MOBILE.bottomNavInactiveStrokeWidth
            }
            className="shrink-0"
          />
          <span className={labelClass(activeView === 'mojPlan')}>Plan</span>
        </motion.button>

        <div className={BOTTOM_NAV_MOBILE.composeWrapperClass}>
          <motion.button
            type="button"
            onClick={onOpenCompose}
            whileHover={BOTTOM_NAV_MOBILE.motion.composeHover}
            whileTap={BOTTOM_NAV_MOBILE.motion.composeTap}
            transition={BOTTOM_NAV_MOBILE.motion.composeTransition}
            className={BOTTOM_NAV_MOBILE.composeButtonClass}
            aria-label="Napisz wpis"
          >
            <ComposePlusIcon />
          </motion.button>
        </div>

        <motion.button
          type="button"
          onClick={onOpenNotifications}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={tabClass(activeView === 'notifications')}
          aria-label="Powiadomienia"
        >
          <div className="relative shrink-0">
            <Bell
              size={ICONS_MOBILE.bottomNavIconSize}
              strokeWidth={
                activeView === 'notifications'
                  ? ICONS_MOBILE.bottomNavActiveStrokeWidth
                  : ICONS_MOBILE.bottomNavInactiveStrokeWidth
              }
              className={`${BOTTOM_NAV_MOBILE.bellIconClass} ${
                activeView === 'notifications'
                  ? BOTTOM_NAV_MOBILE.bellActiveClass
                  : BOTTOM_NAV_MOBILE.bellInactiveClass
              }`}
            />
            {unreadCount > 0 && (
              <span className={BOTTOM_NAV_MOBILE.unreadBadgeClass}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className={labelClass(activeView === 'notifications')}>Alerty</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveView('profile')}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={tabClass(activeView === 'profile')}
          aria-label="Profil"
        >
          <User
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={
              activeView === 'profile'
                ? ICONS_MOBILE.bottomNavActiveStrokeWidth
                : ICONS_MOBILE.bottomNavInactiveStrokeWidth
            }
            className="shrink-0"
          />
          <span className={labelClass(activeView === 'profile')}>Profil</span>
        </motion.button>
      </div>
    </nav>
  )
}
