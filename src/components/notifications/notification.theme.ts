import type { AppNotification } from '../../types'
import { getDeptAccent } from '../../lib/departments'

export const notificationGlass = {
  panel:
    'rounded-2xl border border-zinc-900/10 bg-white/85 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#0a0a0f]/85 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]',
  sheet:
    'rounded-t-3xl border-t border-zinc-900/10 bg-white/85 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_-24px_60px_-20px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#0a0a0f]/85 dark:shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.85)]',
} as const

export const motionPresets = {
  sheetSpring: { type: 'spring' as const, stiffness: 320, damping: 30 },
  panelSpring: { type: 'spring' as const, stiffness: 360, damping: 28 },
  backdropFade: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
  itemStagger: 0.04,
  itemEnter: {
    initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, x: -12, transition: { duration: 0.18 } },
  },
} as const

export function getNotificationBadgeBackground(notif: AppNotification): string {
  if (notif.type === 'like') {
    return 'linear-gradient(135deg, var(--brand-gold), var(--brand-gold-bright))'
  }

  const facultyColor = notif.actor?.department ? getDeptAccent(notif.actor.department).hex : null
  return facultyColor ?? 'var(--brand-gold)'
}
