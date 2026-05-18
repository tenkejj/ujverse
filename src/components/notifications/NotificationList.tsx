import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell } from 'lucide-react'
import type { AppNotification } from '../../types'
import NotificationItem from './NotificationItem'
import { motionPresets } from './notification.theme'

type Props = {
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onClearAll: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-900/6 px-4 py-3 dark:border-white/8">
      <motion.div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/8" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/8" />
        <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-black/5 dark:bg-white/6" />
      </div>
    </div>
  )
}

export default function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const listRef = useRef<HTMLDivElement | null>(null)
  const unread = notifications.filter((notif) => !notif.is_read)
  const read = notifications.filter((notif) => notif.is_read)
  const hasAny = notifications.length > 0

  useEffect(() => {
    const firstRow = listRef.current?.querySelector<HTMLButtonElement>('[data-notification-row="true"]')
    firstRow?.focus()
  }, [loading, notifications.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-12 pr-2 pt-2"
      >
        {loading ? (
          <div className="pt-2">
            {[0, 1, 2, 3].map((key) => (
              <SkeletonRow key={key} />
            ))}
          </div>
        ) : !notifications.length ? (
          <motion.div
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Bell size={22} className="text-zinc-400 dark:text-brand-gold/40" />
            <p className="text-sm font-medium tracking-wide text-fg-primary dark:text-brand-gold/60">Brak powiadomień</p>
          </motion.div>
        ) : (
          <div className="pb-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {unread.map((notif, index) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={motionPresets.itemEnter.initial}
                  animate={motionPresets.itemEnter.animate}
                  exit={motionPresets.itemEnter.exit}
                  transition={{
                    layout: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: shouldReduceMotion ? 0.12 : 0.26, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger },
                    y: { duration: shouldReduceMotion ? 0.12 : 0.3, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger, ease: [0.16, 1, 0.3, 1] },
                    filter: { duration: shouldReduceMotion ? 0.12 : 0.3, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger },
                  }}
                >
                  <NotificationItem
                    notif={notif}
                    isLastInList={read.length === 0 && index === unread.length - 1}
                    onMarkRead={onMarkRead}
                    onNavigateToPost={onNavigateToPost}
                    onNavigateToUser={onNavigateToUser}
                    onClose={onClose}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {unread.length > 0 && read.length > 0 && (
              <div className="my-4 flex items-center justify-center px-4" aria-hidden>
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-zinc-900/10 to-transparent dark:via-white/10" />
                <span className="mx-3 h-1.5 w-1.5 rounded-full bg-zinc-500/30 dark:bg-white/20" />
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-zinc-900/10 to-transparent dark:via-white/10" />
              </div>
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {read.map((notif, index) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={motionPresets.itemEnter.initial}
                  animate={motionPresets.itemEnter.animate}
                  exit={motionPresets.itemEnter.exit}
                  transition={{
                    layout: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: shouldReduceMotion ? 0.12 : 0.26, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger },
                    y: { duration: shouldReduceMotion ? 0.12 : 0.3, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger, ease: [0.16, 1, 0.3, 1] },
                    filter: { duration: shouldReduceMotion ? 0.12 : 0.3, delay: shouldReduceMotion ? 0 : index * motionPresets.itemStagger },
                  }}
                >
                  <NotificationItem
                    notif={notif}
                    isLastInList={index === read.length - 1}
                    onMarkRead={onMarkRead}
                    onNavigateToPost={onNavigateToPost}
                    onNavigateToUser={onNavigateToUser}
                    onClose={onClose}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {hasAny && (
        <div
          className="sticky bottom-0 z-10 shrink-0 border-t border-zinc-900/5 bg-linear-to-t from-white/95 via-white/80 to-transparent px-4 py-3 backdrop-blur-md backdrop-saturate-150 dark:border-white/5 dark:from-bg-card/95 dark:via-bg-card/90 dark:to-transparent"
        >
          <button
            type="button"
            onClick={onClearAll}
            disabled={!hasAny || loading}
            className="mx-auto block w-full text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#1e293b] transition-colors hover:text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-30 dark:text-brand-gold-bright dark:hover:text-brand-gold"
          >
            Wyczyść wszystko
          </button>
        </div>
      )}
    </div>
  )
}
