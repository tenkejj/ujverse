import { useRef, useEffect } from 'react'
import { Bell, ChevronDown, Home, LogOut, Moon, Settings, Sun, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import SearchBar from './SearchBar'
import logoSrc from '../assets/logo.png'
import { useTheme } from '../ThemeContext'

type ActiveView = 'feed' | 'profile' | 'notifications'

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
  onOpenProfileModal: () => void
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
  onOpenProfileModal,
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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md dark:bg-bg-app/80 border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-4 lg:px-6 relative flex items-center h-[76px]">

        {/* Wyszukiwarka — lewa strona */}
        <SearchBar onNavigateToUser={onNavigateToUser} onNavigateToPost={onNavigateToPost} />

        {/* Logo — wyśrodkowane absolutnie */}
        <button
          type="button"
          onClick={onNavigateToFeed}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shrink-0 focus:outline-none"
          aria-label="Strona główna"
        >
          <img
            src={logoSrc}
            alt="UJverse"
            className="h-[72px] w-auto [filter:invert(1)_sepia(1)_saturate(10)_hue-rotate(192deg)_brightness(0.45)] dark:[filter:sepia(1)_saturate(6)_hue-rotate(355deg)_brightness(1.1)]"
          />
        </button>

        {/* Prawe akcje */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Desktop-only nav icons */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={onNavigateToFeed}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
                activeView === 'feed'
                  ? 'text-uj-orange'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-label="Strona główna"
            >
              <Home size={17} strokeWidth={activeView === 'feed' ? 2.5 : 1.8} />
            </button>
            <button
              type="button"
              onClick={onNavigateToNotifications}
              className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
                activeView === 'notifications'
                  ? 'text-uj-orange'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-label="Powiadomienia"
            >
              <Bell size={17} strokeWidth={activeView === 'notifications' ? 2.5 : 1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-uj-orange text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Przełącznik motywu */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-uj-blue dark:hover:text-uj-orange hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            aria-label={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* User Pill + Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full pl-1.5 pr-2.5 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu użytkownika"
            >
              <UserAvatar profile={myProfile} name={displayName} className="h-7 w-7" textSize="text-xs" />
              <span className="hidden sm:inline text-gray-700 dark:text-gray-200 text-sm font-medium max-w-[100px] truncate">
                {displayName}
              </span>
              <ChevronDown
                size={13}
                className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
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
                  className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#0f1a2e] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden origin-top-right"
                >
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
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
                      <Settings size={15} className="text-slate-400 dark:text-gray-500 shrink-0" />
                      Ustawienia
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700/60 py-1">
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
      </div>
    </header>
  )
}
