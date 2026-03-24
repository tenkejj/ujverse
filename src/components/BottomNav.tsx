import { Bell, Home, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

type ActiveView = 'feed' | 'profile' | 'notifications'

type Props = {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  onOpenCompose: () => void
}

export default function BottomNav({ activeView, setActiveView, onOpenCompose }: Props) {
  const iconBtn = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-1 px-6 py-2 transition-colors ${
      isActive
        ? 'text-uj-orange'
        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
    }`

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end justify-around h-16">
        {/* Home */}
        <button
          type="button"
          onClick={() => setActiveView('feed')}
          className={iconBtn(activeView === 'feed')}
          aria-label="Strona główna"
        >
          <Home size={22} strokeWidth={activeView === 'feed' ? 2.5 : 1.8} />
        </button>

        {/* Plus — center floating button */}
        <div className="flex items-center justify-center -mt-5">
          <motion.button
            type="button"
            onClick={onOpenCompose}
            whileTap={{ scale: 0.9 }}
            className="w-14 h-14 rounded-full bg-uj-blue text-white flex items-center justify-center shadow-lg hover:bg-uj-navy transition-colors"
            aria-label="Napisz wpis"
          >
            <Plus size={28} strokeWidth={2.2} />
          </motion.button>
        </div>

        {/* Bell */}
        <button
          type="button"
          onClick={() => setActiveView('notifications')}
          className={iconBtn(activeView === 'notifications')}
          aria-label="Powiadomienia"
        >
          <Bell size={22} strokeWidth={activeView === 'notifications' ? 2.5 : 1.8} />
        </button>
      </div>
    </nav>
  )
}
