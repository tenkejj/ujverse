import {
  ArrowUpRight,
  ChevronDown,
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
 * Desktop navigation separates the assistant, information and personal areas.
 * Utility controls remain reachable outside the content scroller.
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
      className={`app-sidebar ${SIDE_NAV_DESKTOP.containerClass}`}
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
                <VersuMark size={56} />
                <span>
                  <strong>
                    Versuś <span>AI</span>
                  </strong>
                  <small>
                    {isAuthenticated ? 'Zapytaj o UJ' : 'Bez logowania'}
                  </small>
                </span>
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            </div>
            <div className={`sidebar-nav-group ${SIDE_NAV_DESKTOP.groupClass}`}>
              <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>Na uczelni</p>
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
                  className={`sidebar-nav-group ${SIDE_NAV_DESKTOP.groupClass}`}
                >
                  <p className={SIDE_NAV_DESKTOP.sectionLabelClass}>
                    Dla Ciebie
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

            <details className="sidebar-services">
              <summary>
                <GraduationCap size={18} aria-hidden />
                <span>Serwisy UJ</span>
                <ChevronDown size={15} aria-hidden />
              </summary>
              <div className={SIDE_NAV_DESKTOP.groupClass}>
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
            </details>
          </nav>

          <nav className="sidebar-controls" aria-label="Ustawienia i konto">
            <div className={SIDE_NAV_DESKTOP.groupClass}>
              <NavItem
                icon={Settings}
                label="Ustawienia"
                title="Ustawienia"
                active={active === 'settings'}
                onClick={() => onNavigate('settings')}
                variant="sidebar"
              />
              <NavItem
                icon={ThemeIcon}
                label={THEME_META[colorMode].shortLabel}
                active={false}
                onClick={cycleTheme}
                variant="sidebar"
                title={`Motyw: ${THEME_META[colorMode].label}. Zmień motyw`}
                ariaLabel={`Motyw: ${THEME_META[colorMode].label}. Zmień motyw`}
              />
              {isAuthenticated ? (
                <NavItem
                  icon={LogOut}
                  label="Wyloguj się"
                  title="Wyloguj się"
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
                  title="Zaloguj się — plan, Aula i społeczność"
                />
              )}
            </div>
          </nav>
        </div>
      </div>
    </aside>
  )
}
