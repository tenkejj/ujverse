import {
  ArrowUpRight,
  GraduationCap,
  LogIn,
  LogOut,
  Moon,
  Settings,
  Sun,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { THEME_META, useTheme } from '../ThemeContext'
import { SIDE_NAV_DESKTOP } from '../styles/mobile-theme'
import '../styles/sidebar-scroll.css'
import VersuMark from './chat/VersuMark'
import { NIEZBEDNIK_LINKS } from './Niezbednik'
import NavItem from './nav/NavItem'
import {
  ACCOUNT_NAV,
  PRIMARY_NAV,
  navTargetForView,
  type NavTarget,
} from './nav/navModel'

type Props = {
  /** Efektywny widok aplikacji (`AppShellView`) — podświetlenie wylicza `navTargetForView`. */
  activeView: string
  isAuthenticated: boolean
  unreadCount: number
  aulaHasUnread?: boolean
  onNavigate: (target: NavTarget) => void
  onSignOut: () => void
  loginHref: string
}

/**
 * Lewy sticky sidebar (>=lg) — wariant **Unified Glass**. Najpierw sekcja
 * „Informacje" (dla wszystkich), potem „Twoje konto" (tylko zalogowani).
 * Sidebar jest bezstanowy — nawigacja idzie przez `onNavigate` z `App.tsx`.
 */
export default function SideNav({
  activeView,
  isAuthenticated,
  unreadCount,
  aulaHasUnread,
  onNavigate,
  onSignOut,
  loginHref,
}: Props) {
  const { theme: colorMode, cycleTheme } = useTheme()
  const navigate = useNavigate()
  const ThemeIcon =
    colorMode === 'dark' ? Moon : colorMode === 'uj' ? GraduationCap : Sun
  const active = navTargetForView(activeView)

  return (
    <aside
      aria-label="Nawigacja główna"
      className={SIDE_NAV_DESKTOP.containerClass}
    >
      <div className={SIDE_NAV_DESKTOP.stickyClass}>
        <div className={`sidebar-surface ${SIDE_NAV_DESKTOP.innerClass}`}>
          <nav
            className={`versus-sidebar sidebar-scroll-area ${SIDE_NAV_DESKTOP.scrollAreaClass}`}
            aria-label="Sekcje UJverse"
          >
            <div className="sidebar-versus">
              <Link
                to="/chat"
                className="sidebar-versus-link"
                aria-current={active === 'chat' ? 'page' : undefined}
              >
                <VersuMark size={34} />
                <span>
                  <strong>
                    Versuś <span>AI</span>
                  </strong>
                  <small>Twój asystent na UJ</small>
                </span>
                <ArrowUpRight size={15} aria-hidden />
              </Link>
              <p>
                {isAuthenticated
                  ? 'Zapytaj o sprawy uczelni'
                  : 'Dostępny także bez logowania'}
              </p>
            </div>
            <div className={SIDE_NAV_DESKTOP.groupClass}>
              <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>Informacje</p>
              {PRIMARY_NAV.filter((entry) => entry.target !== 'chat').map(
                (entry) => (
                  <NavItem
                    key={entry.target}
                    icon={entry.icon}
                    label={entry.label}
                    title={entry.title}
                    active={active === entry.target}
                    onClick={() => onNavigate(entry.target)}
                    variant="sidebar"
                  />
                ),
              )}
            </div>

            {isAuthenticated ? (
              <>
                <div
                  className={SIDE_NAV_DESKTOP.groupDividerClass}
                  aria-hidden
                />
                <div className={SIDE_NAV_DESKTOP.groupClass}>
                  <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>
                    Twoje konto
                  </p>
                  {ACCOUNT_NAV.map((entry) => (
                    <NavItem
                      key={entry.target}
                      icon={entry.icon}
                      label={entry.label}
                      title={entry.title}
                      active={active === entry.target}
                      onClick={() => onNavigate(entry.target)}
                      variant="sidebar"
                      hasUnread={
                        entry.target === 'aula' ? aulaHasUnread : undefined
                      }
                      badgeCount={
                        entry.target === 'notifications'
                          ? unreadCount
                          : undefined
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}

            <div className={SIDE_NAV_DESKTOP.groupDividerClass} aria-hidden />
            <div className={SIDE_NAV_DESKTOP.groupClass}>
              <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>Serwisy UJ</p>
              {NIEZBEDNIK_LINKS.map(({ label, href, Icon }) => (
                <NavItem
                  key={label}
                  icon={Icon}
                  label={label}
                  active={false}
                  href={href}
                  variant="sidebar"
                />
              ))}
            </div>
            <div className="flex-1 min-h-2" />

            <div className={SIDE_NAV_DESKTOP.groupDividerClass} aria-hidden />

            <div className={SIDE_NAV_DESKTOP.groupClass}>
              {isAuthenticated ? (
                <NavItem
                  icon={Settings}
                  label="Ustawienia"
                  active={active === 'settings'}
                  onClick={() => onNavigate('settings')}
                  variant="sidebar"
                />
              ) : null}
              <NavItem
                icon={ThemeIcon}
                label={THEME_META[colorMode].shortLabel}
                active={false}
                onClick={cycleTheme}
                variant="sidebar"
                title="Zmień motyw: Jasny → Kolory UJ → Ciemny"
              />
              {isAuthenticated ? (
                <NavItem
                  icon={LogOut}
                  label="Wyloguj się"
                  active={false}
                  onClick={onSignOut}
                  variant="sidebar"
                />
              ) : (
                <NavItem
                  icon={LogIn}
                  label="Zaloguj się"
                  active={false}
                  onClick={() => navigate(loginHref)}
                  variant="sidebar"
                  title="Konto daje dostęp do Mojego planu, Auli i społeczności"
                />
              )}
            </div>
          </nav>
        </div>
      </div>
    </aside>
  )
}
