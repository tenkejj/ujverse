import { useEffect, useRef, useState } from 'react'
import {
  AlarmClock,
  BookOpen,
  Bell,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Tag,
  User,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTheme } from '../ThemeContext'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'
import NavItem from './nav/NavItem'
import { MOBILE_DRAWER } from '../styles/mobile-theme'
import { getDeptAbbreviation } from '../lib/departments'
import { DEPT_BADGE_SPAN_CLASS } from '../lib/interactionBar'
import { NIEZBEDNIK_LINKS } from './Niezbednik'
import { OFFICIAL_TAG_META, TAG_ICONS, getZones } from '../services/TagService'
import { groupPathForSlug } from '../lib/groupPaths'

type ActiveView =
  | 'feed'
  | 'profile'
  | 'notifications'
  | 'events'
  | 'aula'
  | 'mojPlan'
  | 'znizki'
  | 'usos'
  | 'miejsca'

type Props = {
  open: boolean
  onClose: () => void
  myProfile: Profile | null
  displayName: string
  activeView: ActiveView
  unreadCount: number
  aulaHasUnread?: boolean
  onNavigateToFeed: () => void
  onNavigateToEvents: () => void
  onNavigateToAula: () => void
  onNavigateToNotifications: () => void
  onNavigateToProfile: () => void
  onNavigateToMojPlan: () => void
  onNavigateToZnizki: () => void
  onNavigateToUsos: () => void
  onNavigateToMiejsca: () => void
  onNavigateToSettings: () => void
  onNavigateToSearch: (query?: string) => void
}

/**
 * Slide-in drawer dla `<lg`. Otwierany burgerem w `Header.tsx`.
 * Zawiera: avatar/header (klik → profil), search input (Enter →
 * `onNavigateToSearch`), grupy sekcji (Główne, Strefa studenta, Konto)
 * oraz bottom row (theme + wyloguj). Zamykany backdrop-click,
 * Escape lub kliknięciem w pozycję — każda nawigacja sama zamyka
 * drawer (zasada: jeden klik = przejście).
 */
export default function MobileDrawer({
  open,
  onClose,
  myProfile,
  displayName,
  activeView,
  unreadCount,
  aulaHasUnread,
  onNavigateToFeed,
  onNavigateToEvents,
  onNavigateToAula,
  onNavigateToNotifications,
  onNavigateToProfile,
  onNavigateToMojPlan,
  onNavigateToZnizki,
  onNavigateToUsos,
  onNavigateToMiejsca,
  onNavigateToSettings,
  onNavigateToSearch,
}: Props) {
  const { theme: colorMode, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const zoneSlugs = getZones(3)

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
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const wrap = (callback: () => void) => () => {
    onClose()
    callback()
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchValue.trim()
    onClose()
    onNavigateToSearch(query || undefined)
    setSearchValue('')
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-drawer-root"
          className={MOBILE_DRAWER.rootClass}
          aria-hidden={!open}
          role="dialog"
          aria-modal="true"
          aria-label="Menu nawigacji"
        >
          <motion.button
            type="button"
            className={MOBILE_DRAWER.backdropClass}
            onClick={onClose}
            aria-label="Zamknij menu"
            initial={MOBILE_DRAWER.motion.backdropInitial}
            animate={MOBILE_DRAWER.motion.backdropAnimate}
            exit={MOBILE_DRAWER.motion.backdropExit}
            transition={MOBILE_DRAWER.motion.backdropTransition}
          />
          <motion.div
            className={MOBILE_DRAWER.panelClass}
            initial={MOBILE_DRAWER.motion.panelInitial}
            animate={MOBILE_DRAWER.motion.panelAnimate}
            exit={MOBILE_DRAWER.motion.panelExit}
            transition={MOBILE_DRAWER.motion.panelTransition}
          >
            <div className={MOBILE_DRAWER.headerClass}>
              <button
                type="button"
                onClick={wrap(onNavigateToProfile)}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:focus-visible:ring-brand-gold/40"
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
              <button
                type="button"
                onClick={onClose}
                className={MOBILE_DRAWER.closeButtonClass}
                aria-label="Zamknij menu"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className={MOBILE_DRAWER.searchWrapperClass}>
              <div className="relative">
                <Search size={18} strokeWidth={2} className={MOBILE_DRAWER.searchIconClass} />
                <input
                  ref={inputRef}
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Szukaj w UJverse"
                  className={MOBILE_DRAWER.searchInputClass}
                  aria-label="Szukaj"
                />
              </div>
            </form>

            <div className={MOBILE_DRAWER.scrollAreaClass}>
              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Główne</p>
                <NavItem
                  icon={Home}
                  label="Strona główna"
                  active={activeView === 'feed'}
                  onClick={wrap(onNavigateToFeed)}
                  variant="drawer"
                />
                <NavItem
                  icon={CalendarDays}
                  label="Wydarzenia"
                  active={activeView === 'events'}
                  onClick={wrap(onNavigateToEvents)}
                  variant="drawer"
                />
                <NavItem
                  icon={GraduationCap}
                  label="Aula"
                  active={activeView === 'aula'}
                  onClick={wrap(onNavigateToAula)}
                  variant="drawer"
                  hasUnread={aulaHasUnread}
                />
                <NavItem
                  icon={Bell}
                  label="Powiadomienia"
                  active={activeView === 'notifications'}
                  onClick={wrap(onNavigateToNotifications)}
                  variant="drawer"
                  badgeCount={unreadCount}
                />
                <NavItem
                  icon={User}
                  label="Profil"
                  active={activeView === 'profile'}
                  onClick={wrap(onNavigateToProfile)}
                  variant="drawer"
                />
              </div>

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Strefa studenta</p>
                <NavItem
                  icon={ClipboardList}
                  label="Mój Plan"
                  active={activeView === 'mojPlan'}
                  onClick={wrap(onNavigateToMojPlan)}
                  variant="drawer"
                />
                <NavItem
                  icon={Tag}
                  label="Couponek UJ"
                  active={activeView === 'znizki'}
                  onClick={wrap(onNavigateToZnizki)}
                  variant="drawer"
                />
                <NavItem
                  icon={AlarmClock}
                  label="Rejestracje USOS"
                  active={activeView === 'usos'}
                  onClick={wrap(onNavigateToUsos)}
                  variant="drawer"
                />
                <NavItem
                  icon={BookOpen}
                  label="Miejsca do nauki"
                  active={activeView === 'miejsca'}
                  onClick={wrap(onNavigateToMiejsca)}
                  variant="drawer"
                />
              </div>

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Strefy</p>
                {zoneSlugs.map((slug) => {
                  const meta = OFFICIAL_TAG_META[slug]
                  const Icon = TAG_ICONS[slug]
                  return (
                    <NavItem
                      key={slug}
                      icon={Icon}
                      label={meta.name}
                      active={false}
                      onClick={wrap(() => navigate(groupPathForSlug(slug)))}
                      variant="drawer"
                      title={meta.name}
                    />
                  )
                })}
              </div>

              <div className={MOBILE_DRAWER.sectionDividerClass} aria-hidden />

              <div className={MOBILE_DRAWER.sectionClass}>
                <p className={MOBILE_DRAWER.sectionLabelClass}>Linki UJ</p>
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
                <p className={MOBILE_DRAWER.sectionLabelClass}>Konto</p>
                <NavItem
                  icon={Settings}
                  label="Ustawienia"
                  active={false}
                  onClick={wrap(onNavigateToSettings)}
                  variant="drawer"
                />
                <NavItem
                  icon={colorMode === 'dark' ? Sun : Moon}
                  label={colorMode === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
                  active={false}
                  onClick={toggleTheme}
                  variant="drawer"
                />
              </div>
            </div>

            <div className={MOBILE_DRAWER.bottomRowClass}>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  void supabase.auth.signOut()
                }}
                className={MOBILE_DRAWER.logoutItemClass}
              >
                <LogOut size={20} strokeWidth={2} className="shrink-0" />
                Wyloguj się
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
