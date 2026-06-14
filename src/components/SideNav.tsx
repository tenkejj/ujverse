import { useState } from 'react'
import {
  AlarmClock,
  BookOpen,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Moon,
  Settings,
  Sun,
  Tag,
  User,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { useTheme } from '../ThemeContext'
import { SIDE_NAV_DESKTOP } from '../styles/mobile-theme'
import NavItem from './nav/NavItem'

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
}

/**
 * Lewy sticky sidebar (>=lg) — wariant **Unified Glass**. Cały sidebar
 * to jeden glass-kontener z subtelnym blur + top-sheen. Sekcje
 * („Główne", „Strefa studenta", „Konto") wewnątrz są oznaczone tylko
 * nagłówkiem i delikatną hairline'ową kreską między grupami — nie ma
 * już osobnych kart-wysp. Items są pełnoszerokimi pigułkami
 * `rounded-full`; aktywna pozycja dostaje gold border + tinted bg.
 *
 * SideNav jest **bezstanowy** w kwestii nawigacji — wszystkie callbacki
 * idą przez props (zasada „session ownership" + jeden hub routingu w
 * `App.tsx`).
 */
export default function SideNav({
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
}: Props) {
  const { theme: colorMode, toggleTheme } = useTheme()
  // Domyślnie zwinięta — żeby pierwszy rzut oka pokazywał tylko 6 głównych
  // pozycji, a nie 11. Mniej zagęszczenia = lepsza czytelność.
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <aside
      aria-label="Nawigacja główna"
      className={SIDE_NAV_DESKTOP.containerClass}
    >
      <div className={SIDE_NAV_DESKTOP.innerClass}>
        <div className={SIDE_NAV_DESKTOP.scrollAreaClass}>
          <div className={SIDE_NAV_DESKTOP.groupClass}>
            <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>Główne</p>
            <NavItem
              icon={Home}
              label="Strona główna"
              active={activeView === 'feed'}
              onClick={onNavigateToFeed}
              variant="sidebar"
            />
            <NavItem
              icon={CalendarDays}
              label="Wydarzenia"
              active={activeView === 'events'}
              onClick={onNavigateToEvents}
              variant="sidebar"
            />
            <NavItem
              icon={GraduationCap}
              label="Aula"
              active={activeView === 'aula'}
              onClick={onNavigateToAula}
              variant="sidebar"
              hasUnread={aulaHasUnread}
              title="Aula — czat rocznika"
            />
            <NavItem
              icon={Bell}
              label="Powiadomienia"
              active={activeView === 'notifications'}
              onClick={onNavigateToNotifications}
              variant="sidebar"
              badgeCount={unreadCount}
            />
            <NavItem
              icon={User}
              label="Profil"
              active={activeView === 'profile'}
              onClick={onNavigateToProfile}
              variant="sidebar"
            />
          </div>

          <div className={SIDE_NAV_DESKTOP.groupDividerClass} aria-hidden />

          <div className={SIDE_NAV_DESKTOP.groupClass}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={SIDE_NAV_DESKTOP.moreToggleClass}
              aria-expanded={moreOpen}
            >
              Strefa studenta
              <motion.span
                aria-hidden
                animate={{ rotate: moreOpen ? 180 : 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className={SIDE_NAV_DESKTOP.moreChevronClass}
              >
                <ChevronDown size={12} strokeWidth={2.4} />
              </motion.span>
            </button>

            {moreOpen && (
              <div className="flex flex-col gap-1.5">
                <NavItem
                  icon={ClipboardList}
                  label="Mój Plan"
                  active={activeView === 'mojPlan'}
                  onClick={onNavigateToMojPlan}
                  variant="sidebar"
                  title="Mój Plan — subskrypcje wykładowców"
                />
                <NavItem
                  icon={Tag}
                  label="Couponek UJ"
                  active={activeView === 'znizki'}
                  onClick={onNavigateToZnizki}
                  variant="sidebar"
                  title="Couponek UJ — zniżki studenckie"
                />
                <NavItem
                  icon={AlarmClock}
                  label="Rejestracje USOS"
                  active={activeView === 'usos'}
                  onClick={onNavigateToUsos}
                  variant="sidebar"
                />
                <NavItem
                  icon={BookOpen}
                  label="Miejsca do nauki"
                  active={activeView === 'miejsca'}
                  onClick={onNavigateToMiejsca}
                  variant="sidebar"
                  title="Miejsca do nauki — live presence"
                />
              </div>
            )}
          </div>

          <div className="flex-1 min-h-2" />

          <div className={SIDE_NAV_DESKTOP.groupDividerClass} aria-hidden />

          <div className={SIDE_NAV_DESKTOP.groupClass}>
            <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>Konto</p>
            <NavItem
              icon={Settings}
              label="Ustawienia"
              active={false}
              onClick={onNavigateToSettings}
              variant="sidebar"
            />
            <NavItem
              icon={colorMode === 'dark' ? Sun : Moon}
              label={colorMode === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
              active={false}
              onClick={toggleTheme}
              variant="sidebar"
            />
            <NavItem
              icon={LogOut}
              label="Wyloguj się"
              active={false}
              onClick={() => void supabase.auth.signOut()}
              variant="sidebar"
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
