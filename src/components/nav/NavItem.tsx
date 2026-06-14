import type { ComponentType, SVGProps } from 'react'
import { motion } from 'framer-motion'
import { MOBILE_DRAWER, SIDE_NAV_DESKTOP } from '../../styles/mobile-theme'

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

type Variant = 'sidebar' | 'drawer'

type Props = {
  icon: LucideIcon
  label: string
  active: boolean
  /** Handler — używany tylko gdy nie podano `href`. */
  onClick?: () => void
  /**
   * Gdy podany — komponent renderuje `<motion.a>` zamiast `<motion.button>`.
   * Linki absolutne (http/https) automatycznie dostają target="_blank" + safe rel.
   * Trzymamy to wewnątrz NavItem, żeby Niezbędnik (PEGAZ/POCZTA/USOS-web)
   * mógł żyć w drawerze obok wewnętrznych pozycji bez potrzeby duplikowania
   * stylów (te same tokeny `MOBILE_DRAWER.itemBaseClass`).
   */
  href?: string
  /** Wariant prezentera — desktopowy SideNav vs. mobile drawer. */
  variant: Variant
  /** Dodatkowy badge liczbowy (np. unread count). */
  badgeCount?: number
  /** Marker „nowe" (kropka) — używane np. dla Auli. */
  hasUnread?: boolean
  /** Opcjonalny tytuł HTML (tooltip) — przydatne, gdy label jest skrócony. */
  title?: string
  /** Opcjonalny `aria-label` (gdy chcemy nadpisać `label`). */
  ariaLabel?: string
}

/**
 * Pojedyncza pozycja nawigacji — wspólna dla `SideNav` (desktop) i
 * `MobileDrawer`. Trzyma jednolity layout `accent-bar | icon | label |
 * badge/dot` z kolorystyką dopasowaną do wybranego wariantu (tokeny w
 * `src/styles/mobile-theme.ts`).
 */
export default function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  href,
  variant,
  badgeCount,
  hasUnread,
  title,
  ariaLabel,
}: Props) {
  const tokens = variant === 'sidebar' ? SIDE_NAV_DESKTOP : MOBILE_DRAWER

  const itemClass = `${tokens.itemBaseClass} ${
    active ? tokens.itemActiveClass : tokens.itemInactiveClass
  }`
  const iconClass = `${tokens.iconBaseClass} ${
    active ? tokens.iconActiveClass : tokens.iconInactiveClass
  }`

  const inner = (
    <>
      <Icon
        size={tokens.iconSize}
        strokeWidth={active ? tokens.iconActiveStrokeWidth : tokens.iconStrokeWidth}
        className={iconClass}
      />
      <span className="truncate">{label}</span>
      {hasUnread && (
        <span aria-hidden className={`ml-auto ${tokens.unreadDotClass}`} />
      )}
      {!hasUnread && typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className={tokens.badgePillClass} aria-label={`${badgeCount} nowych`}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </>
  )

  if (href) {
    const isExternal = /^https?:\/\//i.test(href)
    return (
      <motion.a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className={itemClass}
        aria-label={ariaLabel}
        title={title}
      >
        {inner}
      </motion.a>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={itemClass}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      title={title}
    >
      {inner}
    </motion.button>
  )
}
