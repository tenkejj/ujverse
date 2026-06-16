import { useRef, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { Bell, ChevronDown, LogOut, Menu, Moon, Pencil, Settings, Sun, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import OmniSearchHub from './OmniSearchHub'
import { useTheme } from '../ThemeContext'
import { getDeptAbbreviation } from '../lib/departments'
import { useScrollY } from '../hooks/useScrollY'
import { HEADER_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'
import { DEPT_BADGE_SPAN_CLASS } from '../lib/interactionBar'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events' | 'aula' | 'mojPlan' | 'znizki' | 'usos' | 'miejsca'

type Props = {
  myProfile: Profile | null
  displayName: string
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  activeView: ActiveView
  unreadCount: number
  bellRingTick: number
  notificationsPanelOpen: boolean
  notificationsAnchorRef?: RefObject<HTMLButtonElement | null>
  onToggleNotificationsPanel: () => void
  onCloseNotificationsPanel: () => void
  onNavigateToFeed: () => void
  onNavigateToProfile: () => void
  onNavigateToEvents: (openEventId?: string) => void
  onNavigateToSearch: (query?: string) => void
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  /** Klik w wynik Auli z `OmniSearchHub` — deep-link `/aula?message=<id>`. */
  onNavigateToAulaMessage?: (messageId: number) => void
  /** Cohort zalogowanego usera — przekazany do `OmniSearchHub` jako sekcja Aula. */
  cohortId?: string | null
  onOpenProfileModal: () => void
  onNavigateToSettings: () => void
  onRefreshPosts: () => void
  /** Otwiera mobilny drawer z pełną listą sekcji (`<lg`). */
  onOpenMobileDrawer: () => void
  /** Ten sam `max-w` + padding co `<main>` — wyrównanie headera z treścią. */
  contentShellClass?: string
}

export default function Header({
  myProfile,
  displayName,
  menuOpen,
  setMenuOpen,
  activeView,
  unreadCount,
  bellRingTick,
  notificationsPanelOpen,
  notificationsAnchorRef,
  onToggleNotificationsPanel,
  onCloseNotificationsPanel,
  onNavigateToFeed,
  onNavigateToProfile,
  onNavigateToEvents,
  onNavigateToSearch,
  onNavigateToUser,
  onNavigateToPost,
  onNavigateToAulaMessage,
  cohortId,
  onOpenProfileModal,
  onNavigateToSettings,
  onRefreshPosts,
  onOpenMobileDrawer,
  contentShellClass = 'w-full px-4',
}: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > 10
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { theme: colorMode, toggleTheme } = useTheme()
  const [shakeBell, setShakeBell] = useState(false)
  const bellActive = notificationsPanelOpen || activeView === 'notifications'

  useEffect(() => {
    if (bellRingTick === 0) return
    setShakeBell(true)
    const t = window.setTimeout(() => setShakeBell(false), 520)
    return () => window.clearTimeout(t)
  }, [bellRingTick])

  useEffect(() => {
    if (!menuOpen) return
    const onPD = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPD)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPD)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, setMenuOpen])

  useEffect(() => {
    if (!notificationsPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseNotificationsPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notificationsPanelOpen, onCloseNotificationsPanel])

  return (
    <>
    <header
      className={`w-full sticky top-0 z-50 overflow-visible border-t-0 outline-none ring-0 shadow-none ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-md backdrop-saturate-150 dark:bg-zinc-950/50 dark:backdrop-blur-md dark:backdrop-saturate-150'
          : 'bg-bg-app/80 backdrop-blur-md backdrop-saturate-150 dark:bg-black/20 dark:backdrop-blur-md dark:backdrop-saturate-150'
      }`}
    >
      <div className={`${contentShellClass} ${HEADER_MOBILE.containerClass}`}>
      <div className={`${HEADER_MOBILE.leftZoneClass} relative z-10`}>
        {/* Burger otwiera `MobileDrawer` z pełną listą sekcji + szukajką. Widoczny
         *  na `<lg`, bo od `lg` lewy `SideNav` przejmuje rolę nawigacji. */}
        <div className="block lg:hidden">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onCloseNotificationsPanel()
              onOpenMobileDrawer()
            }}
            aria-label="Otwórz menu"
            className="w-14 h-14 flex items-center justify-center rounded-full text-[#1e293b] dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40"
          >
            <Menu
              size={ICONS_MOBILE.bottomNavIconSize}
              strokeWidth={ICONS_MOBILE.bottomNavInactiveStrokeWidth}
              className="shrink-0"
            />
          </button>
        </div>
        <div className="hidden md:flex items-center min-w-0">
          <OmniSearchHub
            cohortId={cohortId}
            onNavigateToUser={onNavigateToUser}
            onNavigateToPost={onNavigateToPost}
            onNavigateToEvents={onNavigateToEvents}
            onNavigateToSearch={onNavigateToSearch}
            onNavigateToAulaMessage={onNavigateToAulaMessage}
          />
        </div>
      </div>

      <div className={`${HEADER_MOBILE.centerZoneClass} overflow-visible min-w-0`}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            onNavigateToFeed()
            window.scrollTo({ top: 0, behavior: 'smooth' })
            onRefreshPosts()
          }}
          className="overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 inline-flex items-center justify-center border-0"
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
            }}
            className={`${HEADER_MOBILE.logoClass} transition-colors duration-150 ease-in-out dark:bg-brand-gold-bright bg-logo-navy`}
          />
        </motion.button>
      </div>

      <div className={`${HEADER_MOBILE.rightZoneClass} relative z-10`}>
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#1e293b] dark:text-gray-400 hover:text-[#1e293b] hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 ease-in-out"
            aria-label={colorMode === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
          >
            {colorMode === 'dark' ? (
              <Sun size={20} strokeWidth={2} className="shrink-0" />
            ) : (
              <Moon size={20} strokeWidth={2} className="shrink-0" />
            )}
          </button>

          <div className="relative shrink-0">
            <button
              ref={notificationsAnchorRef}
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onToggleNotificationsPanel()
              }}
              aria-expanded={notificationsPanelOpen}
              aria-haspopup="dialog"
              aria-label="Powiadomienia"
              className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-150 ease-in-out hover:bg-black/5 dark:hover:bg-white/10 ${
                bellActive
                  ? 'text-[#1e293b] dark:text-brand-gold-bright ring-2 ring-[#1e293b]/35 dark:ring-brand-gold-bright/45 shadow-[0_0_18px_-4px_rgba(30,41,59,0.35)]'
                  : 'text-[#1e293b] dark:text-gray-400'
              }`}
            >
              <motion.span
                className="flex items-center justify-center"
                animate={
                  shakeBell
                    ? { rotate: [0, -14, 14, -10, 10, -6, 0], x: [0, 2, -2, 1, 0] }
                    : { rotate: 0, x: 0 }
                }
                transition={{ duration: 0.48, ease: [0.36, 0.07, 0.19, 0.99] }}
              >
                <Bell size={20} strokeWidth={2} />
              </motion.span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center pointer-events-none">
                  <motion.span
                    className="absolute rounded-full bg-[#1e293b] dark:bg-brand-gold-bright"
                    style={{ width: 22, height: 22 }}
                    animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
                    transition={{ duration: 1.25, repeat: Infinity, ease: 'easeOut' }}
                    aria-hidden
                  />
                  <span className="relative z-10 min-w-[16px] h-4 rounded-full bg-[#1e293b] text-white text-[9px] font-bold flex items-center justify-center px-0.5 shadow-sm dark:bg-accent-interactive dark:text-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </button>
          </div>

        </div>

        <div className="relative shrink-0 min-w-0 block" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              onCloseNotificationsPanel()
              setMenuOpen((v) => !v)
            }}
            className={`${HEADER_MOBILE.userMenuButtonClass} hover:bg-zinc-800/10 transition-colors duration-150 ease-in-out`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menu użytkownika"
          >
            <UserAvatar
              profile={myProfile}
              name={displayName}
              className={HEADER_MOBILE.userAvatarClass}
              textSize={HEADER_MOBILE.userAvatarTextSize}
            />
            {myProfile?.department && (
              <span className={`hidden md:inline-flex ${DEPT_BADGE_SPAN_CLASS}`}>
                {getDeptAbbreviation(myProfile.department)}
              </span>
            )}
            <span
              className={`hidden md:inline text-zinc-800 dark:text-zinc-400 text-sm font-medium ${HEADER_MOBILE.userNameMaxWidthClass} truncate transition-colors duration-150 ease-in-out group-hover:text-zinc-900 dark:group-hover:text-zinc-100`}
            >
              {displayName}
            </span>
            <ChevronDown
              size={24}
              strokeWidth={2}
              className={`hidden md:block shrink-0 ml-1 text-fg-primary dark:text-zinc-400 transition-transform duration-150 ease-in-out group-hover:text-zinc-900 dark:group-hover:text-zinc-100 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.7 }}
                className="absolute right-0 top-full z-120 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/85 backdrop-blur-md backdrop-saturate-150 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] origin-top-right dark:border-white/10 dark:bg-bg-card/95 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3.5 dark:border-white/10">
                  <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9 shrink-0 ring-1 ring-zinc-900/10 dark:ring-white/10" textSize="text-sm" />
                  <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
                    <p className="w-full text-sm font-semibold leading-tight text-fg-primary dark:text-zinc-100 truncate">
                      {displayName}
                    </p>
                    {myProfile?.department && (
                      <span className={`${DEPT_BADGE_SPAN_CLASS} mt-1 self-start`}>
                        {getDeptAbbreviation(myProfile.department)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-2 py-2">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToProfile() }}
                    className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-[#1e293b]/6 hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <User size={16} strokeWidth={2} className="shrink-0 text-zinc-500 transition-colors group-hover:text-[#1e293b] dark:text-zinc-400 dark:group-hover:text-brand-gold-bright" />
                    Mój profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onOpenProfileModal() }}
                    className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-[#1e293b]/6 hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <Pencil size={16} strokeWidth={2} className="shrink-0 text-zinc-500 transition-colors group-hover:text-[#1e293b] dark:text-zinc-400 dark:group-hover:text-brand-gold-bright" />
                    Edytuj profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToSettings() }}
                    className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-[#1e293b]/6 hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <Settings size={16} strokeWidth={2} className="shrink-0 text-zinc-500 transition-colors group-hover:text-[#1e293b] dark:text-zinc-400 dark:group-hover:text-brand-gold-bright" />
                    Ustawienia
                  </button>
                </div>

                <div className="border-t border-zinc-200 px-2 py-2 dark:border-white/10">
                  <button
                    role="menuitem"
                    onClick={() => void supabase.auth.signOut()}
                    className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-rose-500/85 transition-colors hover:bg-rose-500/8 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-400/85 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                  >
                    <LogOut size={16} strokeWidth={2} className="shrink-0 text-rose-500/85 transition-colors group-hover:text-rose-600 dark:text-rose-400/85 dark:group-hover:text-rose-300" />
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
    </>
  )
}
