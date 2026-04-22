import type { AnnouncementStatus } from '../types/content'

export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = {
  cancelled: 'Odwołane',
  remote: 'Zdalne',
  duty: 'Dyżur',
}

export const ANNOUNCEMENT_STATUS_DOT: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
  remote: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
  duty: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]',
}

export const ANNOUNCEMENT_STATUS_BADGE: Record<AnnouncementStatus, string> = {
  cancelled: 'text-red-400 border-current',
  remote: 'text-blue-300 border-current',
  duty: 'text-emerald-300 border-current',
}
