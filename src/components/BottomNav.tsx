import { Bell, CalendarDays, Home, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useScrollY } from '../hooks/useScrollY'
import { BOTTOM_NAV_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events' | 'mojPlan'

type Props = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  onOpenCompose: () => void
  onOpenNotifications: () => void
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

export default function BottomNav({ activeView, setActiveView, onOpenCompose, onOpenNotifications, unreadCount }: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > BOTTOM_NAV_MOBILE.scrollThreshold
  const iconBtn = (isActive: boolean) =>
    `${BOTTOM_NAV_MOBILE.iconButtonBaseClass} ${
      isActive
        ? BOTTOM_NAV_MOBILE.iconButtonActiveClass
        : BOTTOM_NAV_MOBILE.iconButtonInactiveClass
    }`

  return (
    <nav
      className={`${BOTTOM_NAV_MOBILE.navBaseClass} ${
        isScrolled
          ? BOTTOM_NAV_MOBILE.navScrolledClass
          : BOTTOM_NAV_MOBILE.navDefaultClass
      }`}
      style={{ paddingBottom: BOTTOM_NAV_MOBILE.safeAreaBottomInset }}
    >
      <div className={BOTTOM_NAV_MOBILE.rowClass}>
        <motion.button
          type="button"
          onClick={() => setActiveView('feed')}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={iconBtn(activeView === 'feed')}
          aria-label="Strona główna"
        >
          <Home
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={
              activeView === 'feed' ? ICONS_MOBILE.bottomNavActiveStrokeWidth : ICONS_MOBILE.bottomNavInactiveStrokeWidth
            }
            className="shrink-0"
          />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveView('events')}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={iconBtn(activeView === 'events')}
          aria-label="Wydarzenia"
        >
          <CalendarDays
            size={ICONS_MOBILE.bottomNavIconSize}
            strokeWidth={
              activeView === 'events'
                ? ICONS_MOBILE.bottomNavActiveStrokeWidth
                : ICONS_MOBILE.bottomNavInactiveStrokeWidth
            }
            className="shrink-0"
          />
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
          className={iconBtn(activeView === 'notifications')}
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
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveView('profile')}
          whileTap={BOTTOM_NAV_MOBILE.motion.tabTap}
          className={iconBtn(activeView === 'profile')}
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
        </motion.button>
      </div>
    </nav>
  )
}
