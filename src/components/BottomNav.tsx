import { Bell, CalendarDays, Home, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useScrollY } from '../hooks/useScrollY'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events'

type Props = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  onOpenCompose: () => void
  unreadCount: number
}

const ICON = 28

function ComposePlusIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden className="block shrink-0">
      <line
        x1="12"
        y1="7.5"
        x2="12"
        y2="16.5"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="7.5"
        y1="12"
        x2="16.5"
        y2="12"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function BottomNav({ activeView, setActiveView, onOpenCompose, unreadCount }: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > 10
  const iconBtn = (isActive: boolean) =>
    `flex flex-1 items-center justify-center min-h-[52px] py-3 px-2 transition-colors rounded-xl ${
      isActive
        ? 'text-[#1e293b] dark:text-accent-interactive'
        : 'text-[#1e293b] dark:text-gray-300 dark:hover:text-white/90'
    }`

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 border-t ${
        isScrolled
          ? 'bg-bg-app/80 backdrop-blur-lg border-slate-200 dark:border-white/5'
          : 'bg-bg-app border-border-app'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-center gap-1 px-2 py-1.5 max-w-lg mx-auto min-h-16">
        <motion.button
          type="button"
          onClick={() => setActiveView('feed')}
          whileTap={{ scale: 0.95 }}
          className={iconBtn(activeView === 'feed')}
          aria-label="Strona główna"
        >
          <Home size={ICON} strokeWidth={activeView === 'feed' ? 2.35 : 1.85} className="shrink-0" />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveView('events')}
          whileTap={{ scale: 0.95 }}
          className={iconBtn(activeView === 'events')}
          aria-label="Wydarzenia"
        >
          <CalendarDays size={ICON} strokeWidth={activeView === 'events' ? 2.35 : 1.85} className="shrink-0" />
        </motion.button>

        <div className="flex items-center justify-center shrink-0 px-0.5 min-h-[52px]">
          <motion.button
            type="button"
            onClick={onOpenCompose}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className="h-14 w-14 rounded-full flex items-center justify-center border-0 outline-none shadow-lg
              bg-logo-navy text-white
              dark:bg-gradient-to-br dark:from-brand-gold-bright dark:to-brand-gold dark:text-slate-900 dark:shadow-lg dark:shadow-brand-gold/40
              transition-transform duration-200 hover:brightness-[1.03] active:brightness-[0.97] dark:hover:brightness-105 dark:active:brightness-95"
            aria-label="Napisz wpis"
          >
            <ComposePlusIcon />
          </motion.button>
        </div>

        <motion.button
          type="button"
          onClick={() => setActiveView('notifications')}
          whileTap={{ scale: 0.95 }}
          className={iconBtn(activeView === 'notifications')}
          aria-label="Powiadomienia"
        >
          <div className="relative shrink-0">
            <Bell
              size={ICON}
              strokeWidth={activeView === 'notifications' ? 2.35 : 1.85}
              className={`h-7 w-7 shrink-0 transition-colors ${
                activeView === 'notifications'
                  ? 'text-[#1e293b] dark:text-accent-interactive'
                  : 'text-[#1e293b] dark:text-white dark:hover:text-white/80'
              }`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#1e293b] text-white text-[9px] font-bold flex items-center justify-center px-0.5 dark:bg-accent-gold dark:text-[#060e1f]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => setActiveView('profile')}
          whileTap={{ scale: 0.95 }}
          className={iconBtn(activeView === 'profile')}
          aria-label="Profil"
        >
          <User size={ICON} strokeWidth={activeView === 'profile' ? 2.35 : 1.85} className="shrink-0" />
        </motion.button>
      </div>
    </nav>
  )
}
