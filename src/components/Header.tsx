import { useRef, useEffect } from 'react'
import { Bell, ChevronDown, Home, LogOut, Moon, Settings, Sun } from 'lucide-react'
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
    <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#050b18]/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5">
      <div className="mx-auto max-w-2xl px-4 relative flex items-center h-[76px]">

        {/* Wyszukiwarka — lewa strona */}
        <SearchBar />

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
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
                activeView === 'notifications'
                  ? 'text-uj-orange'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-label="Powiadomienia"
            >
              <Bell size={17} strokeWidth={activeView === 'notifications' ? 2.5 : 1.8} />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-uj-blue dark:hover:text-uj-orange hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
            aria-label={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            type="button"
            onClick={onOpenProfileModal}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-uj-blue dark:hover:text-uj-orange hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
            aria-label="Ustawienia profilu"
          >
            <Settings size={17} />
          </button>

          <div className="relative" ref={menuRef}>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="flex items-center gap-2 rounded-full pl-1 pr-1 py-1 hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                aria-label="Mój profil"
              >
                <UserAvatar profile={myProfile} name={displayName} className="h-7 w-7" textSize="text-xs" />
                <span className="hidden sm:inline text-gray-700 dark:text-gray-200 text-sm font-medium max-w-[100px] truncate">
                  {displayName}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Menu"
              >
                <ChevronDown size={13} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-dark-card rounded-2xl shadow-xl dark:shadow-none border border-slate-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-700 flex items-center gap-3">
                  <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9" textSize="text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-blue-50 truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{email}</p>
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onNavigateToProfile() }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 border-b border-slate-100 dark:border-gray-700 transition-colors"
                >
                  <UserAvatar profile={myProfile} name={displayName} className="h-4 w-4" textSize="text-[8px]" /> Mój profil
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpenProfileModal() }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 border-b border-slate-100 dark:border-gray-700 transition-colors"
                >
                  <Settings size={15} className="text-slate-400 dark:text-gray-500" /> Edytuj profil
                </button>
                <button
                  role="menuitem"
                  onClick={() => void supabase.auth.signOut()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <LogOut size={15} className="text-slate-400 dark:text-gray-500" /> Wyloguj się
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
