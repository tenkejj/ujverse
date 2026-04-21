import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CalendarDays, ChevronDown, Home, LogOut, Moon, Pencil, Settings, Sun, User, Users, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { AppNotification, Profile } from '../types'
import UserAvatar from './UserAvatar'
import SearchBar from './SearchBar'
import NotificationsView from './NotificationsView'
import ClubsModal from './ClubsModal'
import { useTheme } from '../ThemeContext'
import { getDeptAbbreviation } from '../lib/departments'
import { useScrollY } from '../hooks/useScrollY'
import { useClubs } from '../hooks/useContent'
import { HEADER_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'

type ActiveView = 'feed' | 'profile' | 'notifications' | 'events'

type Props = {
  myProfile: Profile | null
  displayName: string
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  activeView: ActiveView
  unreadCount: number
  bellRingTick: number
  notificationsPanelOpen: boolean
  onToggleNotificationsPanel: () => void
  onCloseNotificationsPanel: () => void
  notifications: AppNotification[]
  notificationsLoading: boolean
  onMarkNotificationRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  onClearAllNotifications: () => void
  onNavigateToPostFromNotificationsPanel: (postId: string) => void
  onNavigateToUserFromNotificationsPanel: (userId: string) => void
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToFeed: () => void
  onNavigateToProfile: () => void
  onNavigateToEvents: () => void
  onOpenProfileModal: () => void
  onNavigateToSettings: () => void
  onRefreshPosts: () => void
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
  onToggleNotificationsPanel,
  onCloseNotificationsPanel,
  notifications,
  notificationsLoading,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onNavigateToPostFromNotificationsPanel,
  onNavigateToUserFromNotificationsPanel,
  onNavigateToUser,
  onNavigateToPost,
  onNavigateToFeed,
  onNavigateToProfile,
  onNavigateToEvents,
  onOpenProfileModal,
  onNavigateToSettings,
  onRefreshPosts,
}: Props) {
  const scrollY = useScrollY()
  const isScrolled = scrollY > 10
  const menuRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const { theme, toggleTheme } = useTheme()
  const [shakeBell, setShakeBell] = useState(false)
  const [clubsModalOpen, setClubsModalOpen] = useState(false)
  const { clubs, loading: clubsLoading, error: clubsError, reload: reloadClubs } = useClubs()
  const bellActive = notificationsPanelOpen || activeView === 'notifications'
  const hasAnyNotifications = notifications.length > 0

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

  useEffect(() => {
    if (!notificationsPanelOpen) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [notificationsPanelOpen])

  return (
    <>
    <header
      className={`${HEADER_MOBILE.containerClass} w-full flex items-center justify-between sticky top-0 z-50 overflow-visible transition-all duration-300 border-t-0 outline-none ring-0 shadow-none ${
        isScrolled
          ? 'border-b border-slate-200/90 bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/55 dark:backdrop-blur-md'
          : 'border-b border-transparent bg-bg-app/90 backdrop-blur-md dark:border-transparent dark:bg-black/25 dark:backdrop-blur-md'
      }`}
    >
      <div className={`${HEADER_MOBILE.sideSectionClass} flex-shrink-0 flex items-center justify-start relative z-10`}>
        <SearchBar
          onNavigateToUser={onNavigateToUser}
          onNavigateToPost={onNavigateToPost}
          onNavigateToEvents={onNavigateToEvents}
        />
      </div>

      <div className="flex-1 flex justify-center items-center overflow-visible min-w-0">
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
            className={`mx-auto ${HEADER_MOBILE.logoClass} transition-colors dark:bg-brand-gold-bright bg-logo-navy`}
          />
        </motion.button>
      </div>

      <div className={`${HEADER_MOBILE.sideSectionClass} flex-shrink-0 flex items-center justify-end gap-3 relative z-10`}>
        <div className="hidden md:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onCloseNotificationsPanel()
              setClubsModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-[#1e293b] transition-colors hover:text-[#1e293b] hover:bg-black/5 dark:text-gray-300 dark:hover:text-brand-gold-bright dark:hover:bg-white/10"
            aria-haspopup="dialog"
            aria-expanded={clubsModalOpen}
            aria-label="Koła naukowe"
          >
            <Users size={15} strokeWidth={1.95} />
            <span>Koła Naukowe</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToFeed}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
              activeView === 'feed'
                ? 'text-[#1e293b] dark:text-accent-interactive'
                : 'text-[#1e293b] dark:text-gray-400'
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
                ? 'text-[#1e293b] dark:text-accent-interactive'
                : 'text-[#1e293b] dark:text-gray-400'
            }`}
            aria-label="Wydarzenia"
          >
            <CalendarDays size={20} strokeWidth={activeView === 'events' ? 2.35 : 1.85} />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onToggleNotificationsPanel()
              }}
              aria-expanded={notificationsPanelOpen}
              aria-haspopup="dialog"
              aria-label="Powiadomienia"
              className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/10 ${
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
                <Bell size={20} strokeWidth={bellActive ? 2.35 : 1.85} />
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

        <button
          type="button"
          onClick={toggleTheme}
          className={`${HEADER_MOBILE.themeToggleButtonClass} text-[#1e293b] dark:text-gray-400 hover:text-[#1e293b] hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
          aria-label={theme === 'dark' ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'}
        >
          {theme === 'dark' ? (
            <Sun
              size={ICONS_MOBILE.headerThemeToggleSize}
              strokeWidth={ICONS_MOBILE.headerThemeToggleStrokeWidth}
              className={`shrink-0 ${ICONS_MOBILE.strongStrokeClass}`}
            />
          ) : (
            <Moon
              size={ICONS_MOBILE.headerThemeToggleSize}
              strokeWidth={ICONS_MOBILE.headerThemeToggleStrokeWidth}
              className={`shrink-0 ${ICONS_MOBILE.strongStrokeClass}`}
            />
          )}
        </button>

        <div className="relative shrink-0 min-w-0 block" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              onCloseNotificationsPanel()
              setMenuOpen((v) => !v)
            }}
            className={`${HEADER_MOBILE.userMenuButtonClass} hover:bg-[#1e293b]/10 transition-all duration-300`}
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
              <span
                className={`hidden sm:inline ${HEADER_MOBILE.userDepartmentBadgeClass} font-bold uppercase tracking-wider text-[#1e293b] dark:text-brand-gold-bright border border-[#1e293b] dark:border-brand-gold-bright/40 rounded-full leading-none shrink-0 transition-colors duration-300`}
              >
                {getDeptAbbreviation(myProfile.department)}
              </span>
            )}
            <span
              className={`hidden sm:inline text-[#1e293b] dark:text-gray-200 text-sm font-medium ${HEADER_MOBILE.userNameMaxWidthClass} truncate transition-colors duration-300 group-hover:text-[#1e293b] dark:group-hover:text-brand-gold-bright`}
            >
              {displayName}
            </span>
            <ChevronDown
              size={24}
              strokeWidth={2}
              className={`hidden md:block shrink-0 ml-1 text-[#1e293b] dark:text-gray-500 transition-all duration-300 group-hover:text-[#1e293b] dark:group-hover:text-brand-gold-bright ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#0f172a]/10 bg-white/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 origin-top-right dark:border-white/5 dark:bg-black/55 dark:shadow-2xl dark:shadow-black/50"
              >
                <div className="flex items-center gap-3 border-b border-[#0f172a]/10 px-4 py-3.5 dark:border-white/5">
                  <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9 shrink-0" textSize="text-sm" />
                  <div className="flex min-h-9 min-w-0 flex-1 items-center">
                    <p className="w-full text-sm font-semibold leading-tight text-[#1e293b] dark:text-white truncate">
                      {displayName}
                    </p>
                  </div>
                </div>

                <div className="px-2 py-2">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToProfile() }}
                    className="relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm text-[#1e293b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/35 dark:text-slate-200 dark:hover:bg-white/5 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <User size={15} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" />
                    Mój profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onOpenProfileModal() }}
                    className="relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm text-[#1e293b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/35 dark:text-slate-200 dark:hover:bg-white/5 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <Pencil size={15} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" />
                    Edytuj profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToSettings() }}
                    className="relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm text-[#1e293b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/35 dark:text-slate-200 dark:hover:bg-white/5 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#1e293b] before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                  >
                    <Settings size={15} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" />
                    Ustawienia
                  </button>
                </div>

                <div className="border-t border-[#0f172a]/10 px-2 py-2 dark:border-white/5">
                  <button
                    role="menuitem"
                    onClick={() => void supabase.auth.signOut()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-500/80 transition-colors hover:bg-rose-500/[0.08] hover:text-rose-600/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-400/80 dark:hover:bg-white/5 dark:hover:text-rose-400/90"
                  >
                    <LogOut size={15} className="shrink-0 text-rose-500/80 dark:text-rose-400/80" />
                    Wyloguj się
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

    <ClubsModal
      isOpen={clubsModalOpen}
      onClose={() => setClubsModalOpen(false)}
      clubs={clubs}
      loading={clubsLoading}
      error={clubsError}
      onRetry={() => void reloadClubs()}
    />

    {createPortal(
      <AnimatePresence>
        {notificationsPanelOpen && (
          <motion.div
            key="notifications-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Powiadomienia"
            className="fixed inset-0 z-[200] hidden md:flex flex-col bg-bg-app/95 dark:bg-bg-app/95 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={onCloseNotificationsPanel}
          >
            <motion.div
              ref={notificationsRef}
              className="relative flex flex-1 min-h-0 flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] max-w-6xl mx-auto w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onCloseNotificationsPanel}
                className="absolute top-[max(1rem,env(safe-area-inset-top))] right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-[#1e293b] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-brand-gold-bright"
                aria-label="Zamknij powiadomienia"
              >
                <X size={22} strokeWidth={2} />
              </button>

              <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col pt-20">
                <div className="flex shrink-0 items-center justify-between gap-4 pr-12">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-400">
                    Powiadomienia
                  </h2>
                  <button
                    type="button"
                    onClick={onClearAllNotifications}
                    disabled={!hasAnyNotifications || notificationsLoading}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 transition-colors hover:text-[#1e293b] disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-500 dark:hover:text-brand-gold-bright"
                  >
                    Wyczyść
                  </button>
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <NotificationsView
                    embedded
                    cleanOverlay
                    fullScreenModal
                    notifications={notifications}
                    loading={notificationsLoading}
                    onMarkRead={onMarkNotificationRead}
                    onMarkAllRead={onMarkAllNotificationsRead}
                    onNavigateToPost={onNavigateToPostFromNotificationsPanel}
                    onNavigateToUser={onNavigateToUserFromNotificationsPanel}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  )
}
