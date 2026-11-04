import { useEffect, useRef, useState } from 'react'
import { GraduationCap, LogIn, LogOut, Moon, Search, Settings, Sun, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { THEME_META, useTheme } from '../ThemeContext'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import NavItem from './nav/NavItem'
import { ACCOUNT_NAV, PRIMARY_NAV, navTargetForView, type NavTarget } from './nav/navModel'
import { MOBILE_DRAWER } from '../styles/mobile-theme'
import { getDeptAbbreviation } from '../lib/departments'
import { DEPT_BADGE_SPAN_CLASS } from '../lib/interactionBar'
import { normalizeSearchQuery } from '../lib/info/search'
import { NIEZBEDNIK_LINKS } from './Niezbednik'

type Props = {
  open: boolean
  onClose: () => void
  isAuthenticated: boolean
  myProfile: Profile | null
  displayName: string
  activeView: string
  unreadCount: number
  aulaHasUnread?: boolean
  onNavigate: (target: NavTarget) => void
  onSignOut: () => void
  loginHref: string
}

/**
 * Slide-in drawer dla `<lg`. Ta sama architektura informacji co `SideNav`
 * (`nav/navModel.ts`): najpierw informacje, potem konto. Każda nawigacja
 * zamyka drawer (jeden klik = przejście); Esc i klik w tło też zamykają.
 */
export default function MobileDrawer({
  open,
  onClose,
  isAuthenticated,
  myProfile,
  displayName,
  activeView,
  unreadCount,
  aulaHasUnread,
  onNavigate,
  onSignOut,
  loginHref,
}: Props) {
  const { theme: colorMode, cycleTheme } = useTheme()
  const ThemeIcon = colorMode === 'dark' ? Moon : colorMode === 'uj' ? GraduationCap : Sun
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const active = navTargetForView(activeView)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [open])

  const go = (target: NavTarget) => () => {
    onClose()
    onNavigate(target)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = normalizeSearchQuery(searchValue)
    onClose()
    navigate(query ? `/szukaj?q=${encodeURIComponent(query)}` : '/szukaj', {
      state: { searchNonce: Date.now() },
    })
    setSearchValue('')
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-drawer-root"
          className={MOBILE_DRAWER.rootClass}
          role="dialog"
          aria-modal="true"
          aria-label="Menu nawigacji"
        >
          <motion.button
            type="button"
            className={MOBILE_DRAWER.backdropClass}
            onClick={onClose}
            aria-label="Zamknij menu"
            tabIndex={-1}
            initial={MOBILE_DRAWER.motion.backdropInitial}
            animate={MOBILE_DRAWER.motion.backdropAnimate}
            exit={MOBILE_DRAWER.motion.backdropExit}
            transition={MOBILE_DRAWER.motion.backdropTransition}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={`${MOBILE_DRAWER.panelClass} outline-none`}
            initial={MOBILE_DRAWER.motion.panelInitial}
            animate={MOBILE_DRAWER.motion.panelAnimate}
            exit={MOBILE_DRAWER.motion.panelExit}
            transition={MOBILE_DRAWER.motion.panelTransition}
          >
            <div className={MOBILE_DRAWER.headerClass}>
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={go('profile')}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/30 dark:focus-visible:ring-brand-gold/40"
                    aria-label="Otwórz profil"
                  >
                    <UserAvatar
                      profile={myProfile}
                      name={displayName}
                      className="h-11 w-11 ring-1 ring-zinc-900/10 dark:ring-white/10"
                      textSize="text-base"
                    />
                  </button>
                  <div className={MOBILE_DRAWER.headerNameClass}>
                    <span className={MOBILE_DRAWER.headerNamePrimaryClass}>{displayName}</span>
                    {myProfile?.department && (
                      <span className={`${DEPT_BADGE_SPAN_CLASS} mt-1 self-start`}>
                        {getDeptAbbreviation(myProfile.department)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className={MOBILE_DRAWER.headerNameClass}>
                  <span className={MOBILE_DRAWER.headerNamePrimaryClass}>UJverse</span>
                  <span className={MOBILE_DRAWER.headerNameSecondaryClass}>
                    Informacje dla studentów UJ · nieoficjalnie
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className={MOBILE_DRAWER.closeButtonClass}
                aria-label="Zamknij menu"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className={MOBILE_DRAWER.searchWrapperClass} role="search">
              <div className="relative">
                <Search size={18} strokeWidth={2} className={MOBILE_DRAWER.searchIconClass} aria-hidden />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Szukaj komunikatów, rejestracji…"
                  className={MOBILE_DRAWER.searchInputClass}
                  aria-label="Szukaj informacji"
                  enterKeyHint="search"
                />
              </div>
            </form>

            <nav className={MOBILE_DRAWER.scrollAreaClass} aria-label="Sekcje UJverse">
              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Informacje</p>
                {PRIMARY_NAV.filter((entry) => entry.target !== 'szukaj').map((entry) => (
                  <NavItem
                    key={entry.target}
                    icon={entry.icon}
                    label={entry.label}
                    active={active === entry.target}
                    onClick={go(entry.target)}
                    variant="drawer"
                  />
                ))}
              </div>

              {isAuthenticated ? (
                <>
                  <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />
                  <div className={MOBILE_DRAWER.sectionClass}>
                    <p className={MOBILE_DRAWER.sectionLabelClass}>Twoje konto</p>
                    {ACCOUNT_NAV.map((entry) => (
                      <NavItem
                        key={entry.target}
                        icon={entry.icon}
                        label={entry.label}
                        active={active === entry.target}
                        onClick={go(entry.target)}
                        variant="drawer"
                        hasUnread={entry.target === 'aula' ? aulaHasUnread : undefined}
                        badgeCount={entry.target === 'notifications' ? unreadCount : undefined}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Serwisy UJ</p>
                {NIEZBEDNIK_LINKS.map(({ label, href, Icon }) => (
                  <NavItem
                    key={label}
                    icon={Icon}
                    label={label}
                    active={false}
                    href={href}
                    onClick={onClose}
                    variant="drawer"
                    title={label}
                  />
                ))}
              </div>

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionClass}>
                {isAuthenticated ? (
                  <NavItem
                    icon={Settings}
                    label="Ustawienia"
                    active={active === 'settings'}
                    onClick={go('settings')}
                    variant="drawer"
                  />
                ) : null}
                <NavItem
                  icon={ThemeIcon}
                  label={THEME_META[colorMode].shortLabel}
                  active={false}
                  onClick={cycleTheme}
                  variant="drawer"
                  title="Zmień motyw: Jasny → Kolory UJ → Ciemny"
                />
              </div>
            </nav>

            <div className={MOBILE_DRAWER.bottomRowClass}>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onSignOut()
                  }}
                  className={MOBILE_DRAWER.logoutItemClass}
                >
                  <LogOut size={20} strokeWidth={2} className="shrink-0" />
                  Wyloguj się
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(loginHref)
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl pl-4 pr-3 py-3 text-[14px] font-semibold text-brand-ink transition-colors hover:bg-brand-ink/5 dark:text-brand-gold-bright dark:hover:bg-white/5"
                >
                  <LogIn size={20} strokeWidth={2} className="shrink-0" />
                  Zaloguj się
                  <span className="ml-auto text-[11px] font-medium text-zinc-500 dark:text-zinc-400">plan, Aula</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
