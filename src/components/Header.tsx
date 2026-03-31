import { useRef, useEffect } from 'react'
import { Bell, CalendarDays, ChevronDown, Home, LogOut, Moon, Pencil, Settings, Sun, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import SearchBar from './SearchBar'
import { useTheme } from '../ThemeContext'
import { getDeptAbbreviation } from '../lib/departments'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events'

type Props = {
  myProfile: Profile | null
  displayName: string
  email: string | undefined
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  activeView: ActiveView
  unreadCount: number
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToFeed: () => void
  onNavigateToProfile: () => void
  onNavigateToNotifications: () => void
  onNavigateToEvents: () => void
  onOpenProfileModal: () => void
  onNavigateToSettings: () => void
}

export default function Header({
  myProfile,
  displayName,
  email,
  menuOpen,
  setMenuOpen,
  activeView,
  unreadCount,
  onNavigateToUser,
  onNavigateToPost,
  onNavigateToFeed,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToEvents,
  onOpenProfileModal,
  onNavigateToSettings,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!menuOpen) return
    const onPD = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('pointerdown', onPD)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPD)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, setMenuOpen])

  return (
    <header className="h-16 w-full flex items-center gap-2 px-4 bg-white dark:bg-[#000000] border-b border-slate-200 dark:border-[#1c2b4e] sticky top-0 z-50 overflow-visible">
      <div className="w-24 flex-shrink-0 flex items-center justify-start relative z-10">
        <SearchBar onNavigateToUser={onNavigateToUser} onNavigateToPost={onNavigateToPost} />
      </div>

      <div className="flex-1 flex justify-center items-center overflow-visible">
        <button
          type="button"
          onClick={onNavigateToFeed}
          className="overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-uj-orange/40 inline-flex items-center justify-center border-0"
          aria-label="Strona główna"
        >
          <div
            aria-hidden
            style={{
              maskImage: 'url(/logo.png)',
              WebkitMaskImage: 'url(/logo.png)',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              width: '12rem',
            }}
            className="h-32 w-auto scale-[0.85] translate-y-[2px] transition-colors dark:bg-amber-400 bg-[#0f172a]"
          />
        </button>
      </div>

      <div className="w-24 flex-shrink-0 flex items-center justify-end gap-4 relative z-10">
        {/* Desktop-only nav icons */}
        <div className="hidden md:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateToFeed}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
              activeView === 'feed'
                ? 'text-accent-interactive'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-label="Strona główna"
          >
            <Home size={20} strokeWidth={activeView === 'feed' ? 2.35 : 1.85} />
          </button>
          <button
            type="button"
            onClick={onNavigateToEvents}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
              activeView === 'events'
                ? 'text-uj-orange'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-label="Wydarzenia"
          >
            <CalendarDays size={20} strokeWidth={activeView === 'events' ? 2.35 : 1.85} />
          </button>
          <button
            type="button"
            onClick={onNavigateToNotifications}
            className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
              activeView === 'notifications'
                ? 'text-accent-interactive'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-label="Powiadomienia"
          >
            <Bell size={20} strokeWidth={activeView === 'notifications' ? 2.35 : 1.85} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-accent-interactive text-black text-[9px] font-bold flex items-center justify-center px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="shrink-0 min-w-[40px] min-h-[40px] md:min-w-0 md:min-h-0 flex items-center justify-center rounded-full p-2 text-gray-500 dark:text-gray-400 hover:text-accent-interactive hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
        >
          {theme === 'dark' ? (
            <Sun size={24} strokeWidth={2} className="shrink-0" />
          ) : (
            <Moon size={24} strokeWidth={2} className="shrink-0" />
          )}
        </button>

        <div className="relative shrink-0 min-w-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1.5 min-h-[40px] min-w-[40px] md:min-h-0 md:min-w-0 md:pl-1.5 md:pr-2 md:py-1 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menu użytkownika"
          >
            <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9" textSize="text-xs" />
            {myProfile?.department && (
              <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider text-accent-interactive border border-accent-interactive/25 rounded-full px-1.5 py-0.5 leading-none shrink-0">
                {getDeptAbbreviation(myProfile.department)}
              </span>
            )}
            <span className="hidden sm:inline text-gray-700 dark:text-gray-200 text-sm font-medium max-w-[100px] truncate">
              {displayName}
            </span>
            <ChevronDown
              size={24}
              strokeWidth={2}
              className={`shrink-0 ml-1 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-bg-app rounded-xl shadow-2xl border border-slate-200 dark:border-border-app overflow-hidden origin-top-right"
              >
                <div className="px-4 py-3 bg-slate-50 dark:bg-bg-app border-b border-slate-100 dark:border-border-app flex items-center gap-3">
                  <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9" textSize="text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-blue-50 truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{email}</p>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToProfile() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <User size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
                    Mój profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onOpenProfileModal() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Pencil size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
                    Edytuj profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToSettings() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Settings size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
                    Ustawienia
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-border-app py-1">
                  <button
                    role="menuitem"
                    onClick={() => void supabase.auth.signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={15} className="shrink-0" />
                    Wyloguj się
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
