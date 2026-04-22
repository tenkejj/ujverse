import { Award, CalendarRange, MessageSquareQuote, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { getDeptAbbreviation } from '../../lib/departments'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

type Props = {
  department: string | null | undefined
  joinedAt: string | null | undefined
  repliesCount: number
  attendingEventsCount: number
  isOwn: boolean
}

type Badge = {
  key: string
  icon: ReactNode
  label: string
  title?: string
  accent?: boolean
}

function monthsSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const diffMs = Date.now() - then
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
}

function buildBadges({
  department,
  joinedAt,
  repliesCount,
  attendingEventsCount,
  isOwn,
}: Props): Badge[] {
  const out: Badge[] = []

  if (department) {
    out.push({
      key: 'dept',
      icon: <Sparkles className="h-3 w-3" strokeWidth={2.25} />,
      label: getDeptAbbreviation(department),
      title: department,
      accent: true,
    })
  }

  const months = monthsSince(joinedAt)
  if (months !== null && months >= 1) {
    out.push({
      key: 'tenure',
      icon: <CalendarRange className="h-3 w-3" strokeWidth={2.25} />,
      label: months < 12 ? `Student od ${months} mies.` : `Student od ${Math.floor(months / 12)} lat`,
      title: 'Czas aktywności na UJverse',
    })
  }

  if (repliesCount >= 10) {
    out.push({
      key: 'commenter',
      icon: <MessageSquareQuote className="h-3 w-3" strokeWidth={2.25} />,
      label: 'Wzorowy komentujący',
      title: `${repliesCount} komentarzy`,
    })
  }

  if (isOwn && attendingEventsCount >= 3) {
    out.push({
      key: 'events',
      icon: <Award className="h-3 w-3" strokeWidth={2.25} />,
      label: 'Aktywny uczestnik',
      title: `${attendingEventsCount} wydarzeń w planie`,
    })
  }

  return out
}

function BadgeItem({ badge }: { badge: Badge }) {
  const accentStyle = badge.accent
    ? {
        borderColor: 'var(--profile-accent)',
        color: 'var(--profile-accent)',
      }
    : undefined

  return (
    <span
      title={badge.title ?? badge.label}
      className={`${PROFILE_MOBILE.badgeDock.itemClass} ${PROFILE_MOBILE.badgeDock.itemLightClass} ${PROFILE_MOBILE.badgeDock.itemDarkClass}`}
      style={accentStyle}
    >
      <span className="inline-flex items-center" aria-hidden>
        {badge.icon}
      </span>
      <span className="whitespace-nowrap">{badge.label}</span>
    </span>
  )
}

export function BadgeDockDesktop(props: Props) {
  const badges = buildBadges(props)
  if (badges.length === 0) return null
  const visible = badges.slice(0, 3)
  const hidden = badges.length - visible.length
  return (
    <>
      {visible.map((b) => (
        <BadgeItem key={b.key} badge={b} />
      ))}
      {hidden > 0 ? (
        <span
          className={`${PROFILE_MOBILE.badgeDock.itemClass} ${PROFILE_MOBILE.badgeDock.itemLightClass} ${PROFILE_MOBILE.badgeDock.itemDarkClass}`}
          title={badges
            .slice(3)
            .map((b) => b.label)
            .join(' • ')}
        >
          +{hidden}
        </span>
      ) : null}
    </>
  )
}

export function BadgeDockMobile(props: Props) {
  const badges = buildBadges(props)
  if (badges.length === 0) return null
  return (
    <>
      {badges.map((b) => (
        <BadgeItem key={b.key} badge={b} />
      ))}
    </>
  )
}
