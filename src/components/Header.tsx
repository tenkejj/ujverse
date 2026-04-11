import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CalendarDays, ChevronDown, Home, LogOut, Moon, Pencil, Settings, Sun, User, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { AppNotification, Profile } from '../types'
import UserAvatar from './UserAvatar'
import SearchBar from './SearchBar'
import NotificationsView from './NotificationsView'
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
}

export default function Header({
  myProfile,
  displayName,
  email,
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
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const { theme, toggleTheme } = useTheme()
  const [shakeBell, setShakeBell] = useState(false)
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
    <header className="h-16 w-full flex items-center gap-2 px-4 bg-white dark:bg-[#000000] border-b border-slate-200 dark:border-[#1c2b4e] sticky top-0 z-50 overflow-visible">
      <div className="w-24 flex-shrink-0 flex items-center justify-start relative z-10">
        <SearchBar
          onNavigateToUser={onNavigateToUser}
          onNavigateToPost={onNavigateToPost}
          onNavigateToEvents={onNavigateToEvents}
        />
      </div>

      <div className="flex-1 flex justify-center items-center overflow-visible">
        <button
          type="button"
          onClick={onNavigateToFeed}
          className="overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 inline-flex items-center justify-center border-0"
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
            className="h-32 w-auto scale-[0.85] translate-y-[2px] transition-colors dark:bg-brand-gold-bright bg-[#0f172a]"
          />
        </button>
      </div>

      <div className="w-24 flex-shrink-0 flex items-center justify-end gap-4 relative z-10">
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
                ? 'text-accent-interactive'
                : 'text-gray-500 dark:text-gray-400'
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
                  ? 'text-brand-gold dark:text-brand-gold-bright ring-2 ring-brand-gold/40 dark:ring-brand-gold-bright/45 shadow-[0_0_18px_-4px_rgba(201,162,39,0.55)]'
                  : 'text-gray-500 dark:text-gray-400'
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
                    className="absolute rounded-full bg-brand-gold dark:bg-brand-gold-bright"
                    style={{ width: 22, height: 22 }}
                    animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
                    transition={{ duration: 1.25, repeat: Infinity, ease: 'easeOut' }}
                    aria-hidden
                  />
                  <span className="relative z-10 min-w-[16px] h-4 rounded-full bg-accent-interactive text-black text-[9px] font-bold flex items-center justify-center px-0.5 shadow-sm">
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
            onClick={() => {
              onCloseNotificationsPanel()
              setMenuOpen((v) => !v)
            }}
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
                className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200/20 bg-white/80 shadow-2xl backdrop-blur-lg origin-top-right dark:border-slate-700/30 dark:bg-slate-900/80"
              >
                <div className="flex items-center gap-3 border-b border-slate-200/20 bg-white/50 px-4 py-3 dark:border-slate-700/30 dark:bg-slate-900/40">
                  <UserAvatar profile={myProfile} name={displayName} className="h-9 w-9" textSize="text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-blue-50 truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{email}</p>
                  </div>
                </div>

                <div className="px-1 py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToProfile() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-white/90 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <User size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                    Mój profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onOpenProfileModal() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-white/90 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <Pencil size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                    Edytuj profil
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onNavigateToSettings() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-white/90 dark:text-gray-300 dark:hover:bg-white/10"
                  >
                    <Settings size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                    Ustawienia
                  </button>
                </div>

                <div className="border-t border-slate-200/20 px-1 py-1 dark:border-slate-700/30">
                  <button
                    role="menuitem"
                    onClick={() => void supabase.auth.signOut()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50/90 dark:text-red-400 dark:hover:bg-red-900/25"
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
                className="absolute top-[max(1rem,env(safe-area-inset-top))] right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-brand-gold dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-brand-gold-bright"
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
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 transition-colors hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-500 dark:hover:text-brand-gold-bright"
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
