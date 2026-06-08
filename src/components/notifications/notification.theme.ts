import type { AppNotification } from '../../types'
import { getDeptAccent } from '../../lib/departments'

export const notificationGlass = {
  panelBase:
    'rounded-2xl border border-zinc-200 bg-white/95 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-bg-card/97 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]',
  panelBlur: 'backdrop-blur-md backdrop-saturate-150 bg-white/85 dark:bg-bg-card/90',
  sheetBase:
    'rounded-t-3xl border border-zinc-200 bg-white/95 shadow-[0_-24px_60px_-20px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-bg-card/97 dark:shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.85)]',
  sheetBlur: 'backdrop-blur-md backdrop-saturate-150 bg-white/85 dark:bg-bg-card/90',
} as const

export const motionPresets = {
  sheetSpring: { type: 'spring' as const, stiffness: 460, damping: 40, mass: 0.7 },
  panelTween: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  backdropFade: { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const },
  itemEnter: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
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
