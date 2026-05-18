import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { AppNotification } from '../../types'
import NotificationItem from './NotificationItem'
import { motionPresets } from './notification.theme'

type Props = {
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
  stickyHeader?: boolean
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-900/6 px-4 py-3 dark:border-white/8">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.08]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/[0.07] dark:bg-white/[0.08]" />
        <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
      </div>
    </div>
  )
}

function SectionLabel({ children, secondary = false }: { children: string; secondary?: boolean }) {
  return (
    <p
      className={`px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] ${
        secondary ? 'text-brand-gold/80 dark:text-brand-gold-bright/70' : 'text-zinc-500 dark:text-zinc-400'
      }`}
    >
      {children}
    </p>
  )
}

export default function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
  stickyHeader = false,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const clearButtonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const unread = notifications.filter((notif) => !notif.is_read)
  const read = notifications.filter((notif) => notif.is_read)
  const hasAny = notifications.length > 0
  const hasUnread = unread.length > 0

  useEffect(() => {
    const clearButton = clearButtonRef.current
    if (clearButton && !clearButton.disabled) {
      clearButton.focus()
      return
    }

    const firstRow = listRef.current?.querySelector<HTMLButtonElement>('[data-notification-row="true"]')
    firstRow?.focus()
  }, [loading, notifications.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`flex items-center justify-between border-b border-zinc-900/8 px-4 py-3 dark:border-white/8 ${
          stickyHeader ? 'sticky top-0 z-10 bg-white/80 backdrop-blur-xl dark:bg-[#0a0a0f]/80' : ''
        }`}
      >
        <h2 className="text-[15px] font-semibold tracking-tight text-fg-primary">Powiadomienia</h2>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-700 transition-colors hover:bg-zinc-900/8 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Oznacz
            </button>
          )}
          <button
            ref={clearButtonRef}
            type="button"
            onClick={onClearAll}
            disabled={!hasAny || loading}
            className="rounded-full bg-[#1e293b]/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e293b] transition-colors hover:bg-[#1e293b]/14 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/18"
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {loading ? (
          <div className="pt-2">
            {[0, 1, 2, 3].map((key) => (
              <SkeletonRow key={key} />
            ))}
          </div>
        ) : !notifications.length ? (
          <motion.div
            className="flex flex-col items-center px-4 py-16 text-center"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 dark:border-brand-gold-bright/35 dark:bg-brand-gold/15">
              <Check className="h-7 w-7 text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
            </div>
            <p className="text-[17px] font-medium tracking-tight text-fg-primary">Wszystko nadrobione!</p>
            <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-fg-secondary">Brak nowych powiadomień.</p>
          </motion.div>
        ) : (
          <div className="pb-3">
            {unread.length > 0 && (
              <>
                <SectionLabel>Nowe</SectionLabel>
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
                        onMarkRead={onMarkRead}
                        onNavigateToPost={onNavigateToPost}
                        onNavigateToUser={onNavigateToUser}
                        onClose={onClose}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}

            {read.length > 0 && (
              <>
                <SectionLabel secondary>Wcześniejsze</SectionLabel>
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
                        onMarkRead={onMarkRead}
                        onNavigateToPost={onNavigateToPost}
                        onNavigateToUser={onNavigateToUser}
                        onClose={onClose}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
