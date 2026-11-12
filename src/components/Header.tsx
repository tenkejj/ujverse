import { useId, useLayoutEffect, useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  GraduationCap,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Settings,
  Sun,
  User,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import HeaderSearch from './info/HeaderSearch'
import FacultyPicker from './info/FacultyPicker'
import type { FacultyPreference } from '../hooks/useInfoPreferences'
import { THEME_META, useTheme } from '../ThemeContext'
import { getDeptAbbreviation } from '../lib/departments'
import { useScrollY } from '../hooks/useScrollY'
import { HEADER_MOBILE, ICONS_MOBILE } from '../styles/mobile-theme'
import { DEPT_BADGE_SPAN_CLASS } from '../lib/interactionBar'
import '../styles/app-chrome.css'

type Props = {
  isAuthenticated: boolean
  myProfile: Profile | null
  displayName: string
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  activeView: string
  unreadCount: number
  bellRingTick: number
  notificationsPanelOpen: boolean
  notificationsAnchorRef?: RefObject<HTMLButtonElement | null>
  onToggleNotificationsPanel: () => void
  onCloseNotificationsPanel: () => void
  /** Logo → strona startowa (dashboard informacyjny). */
  onNavigateHome: () => void
  onNavigateToProfile: () => void
  onOpenProfileModal: () => void
  onNavigateToSettings: () => void
  onSignOut: () => void
  /** Dokąd prowadzi „Zaloguj się" (z `?next=` bieżącej strony). */
  loginHref: string
  faculty: FacultyPreference
  /** Otwiera mobilny drawer z pełną listą sekcji (`<lg`). */
  onOpenMobileDrawer: () => void
}

/** Use the artwork bounds, rather than flexing the PNG's large transparent canvas. */
function HeaderLogoArt() {
  const maskId = `ujverse-header-${useId().replace(/:/g, '')}`

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={40}
      height={44}
      viewBox="99 391 526 591"
      preserveAspectRatio="xMidYMid meet"
      className={`${HEADER_MOBILE.logoClass} text-logo-navy dark:text-brand-gold-bright`}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={99}
          y={391}
          width={526}
          height={591}
          style={{ maskType: 'alpha' }}
        >
          <image href="/logo.png" x={0} y={0} width={728} height={1372} />
        </mask>
      </defs>
      <rect
        x={99}
        y={391}
        width={526}
        height={591}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}

export default function Header({
  isAuthenticated,
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
  onNavigateHome,
  onNavigateToProfile,
  onOpenProfileModal,
  onNavigateToSettings,
  onSignOut,
  loginHref,
  faculty,
  onOpenMobileDrawer,
}: Props) {
  const showFacultyStrip = [
    'home',
    'komunikaty',
    'rejestracje',
    'wydarzenia',
    'niezbednik',
    'poradniki',
    'szukaj',
    'chat',
  ].includes(activeView)
  const scrollY = useScrollY()
  const isScrolled = scrollY > 10
  const menuRef = useRef<HTMLDivElement | null>(null)
  const logoAxisRef = useRef<HTMLDivElement | null>(null)
  const { theme: colorMode, cycleTheme } = useTheme()
  const [shakeBell, setShakeBell] = useState(false)
  const bellActive = notificationsPanelOpen || activeView === 'notifications'

  useLayoutEffect(() => {
    const axis = logoAxisRef.current
    if (!axis) return
    let previousOffset = 0
    let frame: number | null = null
    const alignToViewport = () => {
      frame = null
      if (!axis.offsetWidth) return
      const bounds = axis.getBoundingClientRect()
      // Classic scrollbar gutters can change the origin of fixed elements.
      // Measure that origin instead of guessing a browser-specific pixel nudge.
      const unshiftedCentre = bounds.left + bounds.width / 2 - previousOffset
      const nextOffset = window.innerWidth / 2 - unshiftedCentre
      if (Math.abs(nextOffset - previousOffset) < 0.01) return
      axis.style.setProperty('--logo-viewport-offset', `${nextOffset}px`)
      previousOffset = nextOffset
    }
    const scheduleAlignment = () => {
      if (frame === null) frame = window.requestAnimationFrame(alignToViewport)
    }
    alignToViewport()
    const observer = new ResizeObserver(scheduleAlignment)
    observer.observe(document.documentElement)
    window.addEventListener('resize', scheduleAlignment)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleAlignment)
      if (frame !== null) window.cancelAnimationFrame(frame)
      axis.style.removeProperty('--logo-viewport-offset')
    }
  }, [])

  useEffect(() => {
    if (bellRingTick === 0) return
    setShakeBell(true)
    const t = window.setTimeout(() => setShakeBell(false), 520)
    return () => window.clearTimeout(t)
  }, [bellRingTick])

  useEffect(() => {
    if (!menuOpen) return
    const onPD = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
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

  const themeButton = (visibilityClass: string) => (
    <button
      type="button"
      onClick={cycleTheme}
      className={`${HEADER_MOBILE.actionButtonClass} ${visibilityClass}`}
      aria-label={`Motyw: ${THEME_META[colorMode].label}. Kliknij, żeby zmienić.`}
      title={`Motyw: ${THEME_META[colorMode].label}`}
    >
      {colorMode === 'dark' ? (
        <Moon size={20} strokeWidth={2} className="shrink-0" />
      ) : colorMode === 'uj' ? (
        <GraduationCap size={20} strokeWidth={2} className="shrink-0" />
      ) : (
        <Sun size={20} strokeWidth={2} className="shrink-0" />
      )}
    </button>
  )

  const logoButton = (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        onNavigateHome()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      className="pointer-events-auto inline-flex h-11 w-11 lg:h-14 lg:w-14 shrink-0 items-center justify-center overflow-visible rounded-xl border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40"
      aria-label="UJverse — strona startowa"
    >
      <HeaderLogoArt />
    </motion.button>
  )

  const desktopLogo = (
    <div ref={logoAxisRef} className={HEADER_MOBILE.logoAnchorClass}>
      {logoButton}
    </div>
  )

  return (
    <>
      <div aria-hidden className={HEADER_MOBILE.headerSpacerClass} />
      <header
        className={`uj-header-bar relative ${HEADER_MOBILE.containerClass} overflow-visible border-t-0 outline-none ring-0 ${
          isScrolled
            ? 'bg-white backdrop-blur-none dark:bg-zinc-950 lg:bg-white/80 lg:backdrop-blur-md lg:backdrop-saturate-150 lg:dark:bg-zinc-950/50'
            : 'bg-bg-app backdrop-blur-none dark:bg-bg-app lg:bg-bg-app/80 lg:backdrop-blur-md lg:backdrop-saturate-150 lg:dark:bg-black/20'
        }`}
      >
        <div
          className={`${HEADER_MOBILE.sideSectionClass} flex items-center justify-start relative z-10`}
        >
          {/* Burger otwiera `MobileDrawer` z pełną listą sekcji + szukajką. Widoczny
           *  na `<lg`, bo od `lg` lewy `SideNav` przejmuje rolę nawigacji. */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onCloseNotificationsPanel()
                onOpenMobileDrawer()
              }}
              aria-label={
                isAuthenticated && unreadCount > 0
                  ? `Otwórz menu (${unreadCount} nowych powiadomień)`
                  : 'Otwórz menu'
              }
              className={`relative ${HEADER_MOBILE.actionButtonClass}`}
            >
              <Menu
                size={ICONS_MOBILE.bottomNavIconSize}
                strokeWidth={ICONS_MOBILE.bottomNavInactiveStrokeWidth}
                className="shrink-0"
              />
              {isAuthenticated && unreadCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-brand-ink ring-2 ring-bg-app dark:bg-brand-gold-bright"
                />
              ) : null}
            </button>
            {themeButton('min-[360px]:hidden')}
          </div>
          <div
            className={`app-header-faculty ${showFacultyStrip ? 'hidden' : 'hidden lg:flex'} min-w-0`}
          >
            <FacultyPicker
              faculty={faculty.faculty}
              source={faculty.source}
              persistent={faculty.persistent}
              onChange={faculty.setFaculty}
            />
          </div>
        </div>

        <div className={HEADER_MOBILE.logoLaneClass}>
          <div className="flex h-full w-full items-center justify-center lg:hidden">
            {logoButton}
          </div>
        </div>

        <div className={HEADER_MOBILE.rightSectionClass}>
          <div className="hidden md:flex min-w-0 flex-1 items-center justify-end">
            <HeaderSearch />
          </div>
          {themeButton('max-[359px]:hidden')}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onCloseNotificationsPanel()
              onNavigateToSettings()
            }}
            className={HEADER_MOBILE.actionButtonClass}
            aria-label="Ustawienia"
            aria-current={activeView === 'settings' ? 'page' : undefined}
            title="Ustawienia"
          >
            <Settings size={20} strokeWidth={2} aria-hidden="true" />
          </button>

          {isAuthenticated ? (
            <div className="relative hidden md:block shrink-0">
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
                className={`relative ${HEADER_MOBILE.actionButtonClass} ${
                  bellActive
                    ? 'text-brand-ink dark:text-brand-gold-bright ring-2 ring-brand-ink/35 dark:ring-brand-gold-bright/45 shadow-[0_0_18px_-4px_rgba(30,41,59,0.35)]'
                    : 'text-brand-ink dark:text-gray-400'
                }`}
              >
                <motion.span
                  className="flex items-center justify-center"
                  animate={
                    shakeBell
                      ? {
                          rotate: [0, -14, 14, -10, 10, -6, 0],
                          x: [0, 2, -2, 1, 0],
                        }
                      : { rotate: 0, x: 0 }
                  }
                  transition={{
                    duration: 0.48,
                    ease: [0.36, 0.07, 0.19, 0.99],
                  }}
                >
                  <Bell size={20} strokeWidth={2} />
                </motion.span>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center pointer-events-none">
                    <motion.span
                      className="absolute rounded-full bg-brand-ink dark:bg-brand-gold-bright"
                      style={{ width: 22, height: 22 }}
                      animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
                      transition={{
                        duration: 1.25,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                      aria-hidden
                    />
                    <span className="relative z-10 min-w-[16px] h-4 rounded-full bg-brand-ink text-white text-[9px] font-bold flex items-center justify-center px-0.5 shadow-sm dark:bg-accent-interactive dark:text-black">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
              </button>
            </div>
          ) : null}

          {!isAuthenticated ? (
            <Link
              to={loginHref}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 dark:text-brand-gold-bright dark:hover:bg-white/10"
              aria-label="Zaloguj się"
            >
              <LogIn
                size={18}
                strokeWidth={2}
                className="shrink-0"
                aria-hidden
              />
              <span className="hidden sm:inline">Zaloguj się</span>
            </Link>
          ) : (
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
                  <span
                    className={`hidden 2xl:inline-flex ${DEPT_BADGE_SPAN_CLASS}`}
                  >
                    {getDeptAbbreviation(myProfile.department)}
                  </span>
                )}
                <span
                  className={`hidden 2xl:inline text-zinc-800 dark:text-zinc-400 text-sm font-medium ${HEADER_MOBILE.userNameMaxWidthClass} truncate transition-colors duration-150 ease-in-out group-hover:text-zinc-900 dark:group-hover:text-zinc-100`}
                >
                  {displayName}
                </span>
                <ChevronDown
                  size={24}
                  strokeWidth={2}
                  className={`hidden 2xl:block shrink-0 ml-1 text-fg-primary dark:text-zinc-400 transition-transform duration-150 ease-in-out group-hover:text-zinc-900 dark:group-hover:text-zinc-100 ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      y: -4,
                      scale: 0.97,
                      transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 520,
                      damping: 36,
                      mass: 0.7,
                    }}
                    className="absolute right-0 top-full z-120 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/85 backdrop-blur-md backdrop-saturate-150 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] origin-top-right dark:border-white/10 dark:bg-bg-card/95 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]"
                  >
                    <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3.5 dark:border-white/10">
                      <UserAvatar
                        profile={myProfile}
                        name={displayName}
                        className="h-9 w-9 shrink-0 ring-1 ring-zinc-900/10 dark:ring-white/10"
                        textSize="text-sm"
                      />
                      <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
                        <p className="w-full text-sm font-semibold leading-tight text-fg-primary dark:text-zinc-100 truncate">
                          {displayName}
                        </p>
                        {myProfile?.department && (
                          <span
                            className={`${DEPT_BADGE_SPAN_CLASS} mt-1 self-start`}
                          >
                            {getDeptAbbreviation(myProfile.department)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-2 py-2">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          onNavigateToProfile()
                        }}
                        className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-brand-ink/6 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-ink before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                      >
                        <User
                          size={16}
                          strokeWidth={2}
                          className="shrink-0 text-zinc-500 transition-colors group-hover:text-brand-ink dark:text-zinc-400 dark:group-hover:text-brand-gold-bright"
                        />
                        Mój profil
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          onOpenProfileModal()
                        }}
                        className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-brand-ink/6 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-ink before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                      >
                        <Pencil
                          size={16}
                          strokeWidth={2}
                          className="shrink-0 text-zinc-500 transition-colors group-hover:text-brand-ink dark:text-zinc-400 dark:group-hover:text-brand-gold-bright"
                        />
                        Edytuj profil
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          onNavigateToSettings()
                        }}
                        className="group relative flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm font-medium text-fg-primary/85 transition-colors hover:bg-brand-ink/6 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/30 dark:text-zinc-300 dark:hover:bg-white/6 dark:hover:text-brand-gold-bright dark:focus-visible:ring-brand-gold/40 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[55%] before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand-ink before:opacity-0 hover:before:opacity-100 dark:before:bg-brand-gold-bright"
                      >
                        <Settings
                          size={16}
                          strokeWidth={2}
                          className="shrink-0 text-zinc-500 transition-colors group-hover:text-brand-ink dark:text-zinc-400 dark:group-hover:text-brand-gold-bright"
                        />
                        Ustawienia
                      </button>
                    </div>

                    <div className="border-t border-zinc-200 px-2 py-2 dark:border-white/10">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false)
                          onSignOut()
                        }}
                        className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-rose-500/85 transition-colors hover:bg-rose-500/8 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 dark:text-rose-400/85 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                      >
                        <LogOut
                          size={16}
                          strokeWidth={2}
                          className="shrink-0 text-rose-500/85 transition-colors group-hover:text-rose-600 dark:text-rose-400/85 dark:group-hover:text-rose-300"
                        />
                        Wyloguj się
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>
      {showFacultyStrip ? (
        <>
          <div className="faculty-strip-spacer lg:hidden" aria-hidden />
          <div className="faculty-strip">
            <FacultyPicker
              faculty={faculty.faculty}
              source={faculty.source}
              persistent={faculty.persistent}
              onChange={faculty.setFaculty}
            />
          </div>
        </>
      ) : null}
      {createPortal(desktopLogo, document.body)}
    </>
  )
}
