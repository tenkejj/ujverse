import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ACADEMIC_ISI_BADGE_LABEL,
  ACADEMIC_ISI_BADGE_TITLE,
  showAcademicIsiBadge,
} from '../lib/announcementBranding'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../lib/announcementStatusStyles'
import type { AnnouncementMeta, UnifiedContent } from '../types/content'
import UserAvatar from './UserAvatar'

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  announcement: UnifiedContent<AnnouncementMeta> | null
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
            className="fixed inset-0 z-0 bg-black/55 backdrop-blur-sm dark:bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1] max-h-[88vh] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-24px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 dark:shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-white/15" aria-hidden />
            <div className="flex items-start gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
              <UserAvatar
                profile={null}
                name={announcement.author.displayName}
                className="h-11 w-11 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <p
                    id="announcement-drawer-title"
                    className="text-lg font-bold leading-snug text-fg-primary min-w-0 flex-1"
                  >
                    {announcement.author.displayName}
                  </p>
                  {showAcademicIsiBadge(announcement.metadata.source) && (
                    <span
                      className="text-[9px] font-medium leading-none whitespace-nowrap text-fg-secondary opacity-70 shrink-0 text-right"
                      title={ACADEMIC_ISI_BADGE_TITLE}
                    >
                      {ACADEMIC_ISI_BADGE_LABEL}
                    </span>
                  )}
                </div>
                {announcement.timestamp && (
                  <time
                    className="mt-0.5 block text-xs tabular-nums text-fg-secondary"
                    dateTime={announcement.timestamp}
                  >
                    {formatAnnDate(announcement.timestamp)}
                  </time>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-block size-2 shrink-0 rounded-full ${ANNOUNCEMENT_STATUS_DOT[announcement.metadata.status]}`}
                    aria-hidden
                  />
                  <span
                    className={`inline-flex rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ANNOUNCEMENT_STATUS_BADGE[announcement.metadata.status]}`}
                  >
                    {ANNOUNCEMENT_STATUS_LABEL[announcement.metadata.status]}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-primary/90 dark:text-zinc-300">
              {announcement.body}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-zinc-900/6 py-3 text-sm font-semibold text-fg-primary transition-colors hover:bg-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
