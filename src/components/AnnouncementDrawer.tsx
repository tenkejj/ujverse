import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ACADEMIC_ISI_BADGE_LABEL,
  ACADEMIC_ISI_BADGE_TITLE,
  showAcademicIsiBadge,
} from '../lib/announcementBranding'
import type { AcademicAnnouncement, AnnouncementStatus } from '../types'
import UserAvatar from './UserAvatar'

const STATUS_DOT: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500',
  remote: 'bg-blue-500',
  duty: 'bg-emerald-500',
}

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  cancelled: 'Odwołane',
  remote: 'Zdalne',
  duty: 'Dyżur',
}

const BADGE: Record<AnnouncementStatus, string> = {
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  remote: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
  duty: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
}

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  announcement: AcademicAnnouncement | null
  onClose: () => void
}

export default function AnnouncementDrawer({ announcement, onClose }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {announcement && (
        <motion.div
          key={announcement.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-drawer-title"
          className="fixed inset-0 z-[200] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Zamknij"
            className="fixed inset-0 z-0 bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1] max-h-[88vh] overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-600" aria-hidden />
            <div className="flex items-start gap-3 border-b border-zinc-800 pb-4">
              <UserAvatar profile={null} name={announcement.lecturer_name} className="h-11 w-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <p
                    id="announcement-drawer-title"
                    className="text-lg font-bold leading-snug text-zinc-50 min-w-0 flex-1"
                  >
                    {announcement.lecturer_name}
                  </p>
                  {showAcademicIsiBadge(announcement.source) && (
                    <span
                      className="text-[9px] font-medium leading-none whitespace-nowrap text-zinc-500 opacity-60 shrink-0 text-right"
                      title={ACADEMIC_ISI_BADGE_TITLE}
                    >
                      {ACADEMIC_ISI_BADGE_LABEL}
                    </span>
                  )}
                </div>
                <time className="mt-0.5 block text-xs tabular-nums text-zinc-500" dateTime={announcement.created_at}>
                  {formatAnnDate(announcement.created_at)}
                </time>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT[announcement.status]}`}
                    aria-hidden
                  />
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE[announcement.status]}`}
                  >
                    {STATUS_LABEL[announcement.status]}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">
              {announcement.body}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              Zamknij
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
