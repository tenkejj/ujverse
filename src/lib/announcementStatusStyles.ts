import type { AnnouncementStatus } from '../types/content'

export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = {
  cancelled: 'Odwołane',
  remote: 'Zdalne',
  duty: 'Dyżur',
  info: 'Komunikat',
  event: 'Wydarzenie',
}

export const ANNOUNCEMENT_STATUS_DOT: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
  remote: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
  duty: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]',
  info: 'bg-zinc-400 shadow-[0_0_6px_rgba(161,161,170,0.45)]',
  event: 'bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.45)]',
}

export const ANNOUNCEMENT_STATUS_BADGE: Record<AnnouncementStatus, string> = {
  cancelled: 'text-red-800 dark:text-red-400 border-current',
  remote: 'text-blue-800 dark:text-blue-300 border-current',
  duty: 'text-green-900 dark:text-emerald-300 border-current',
  info: 'text-zinc-700 dark:text-zinc-300 border-current',
  event: 'text-violet-800 dark:text-violet-300 border-current',
}
