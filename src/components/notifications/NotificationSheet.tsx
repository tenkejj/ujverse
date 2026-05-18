import { useEffect } from 'react'
import { motion, type PanInfo, useReducedMotion } from 'framer-motion'
import type { AppNotification } from '../../types'
import NotificationList from './NotificationList'
import { motionPresets, notificationGlass } from './notification.theme'

type Props = {
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
}

export default function NotificationSheet({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
}: Props) {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Powiadomienia"
      className="fixed inset-0 z-[210] md:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : motionPresets.backdropFade}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <motion.div
        className={`absolute inset-x-0 bottom-0 z-[220] max-h-[88vh] ${notificationGlass.sheet}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={shouldReduceMotion ? { duration: 0.14 } : motionPresets.sheetSpring}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/15" />
        <div className="max-h-[calc(88vh-0.75rem)] min-h-[300px] min-w-0 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <NotificationList
            stickyHeader
            notifications={notifications}
            loading={loading}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onClearAll={onClearAll}
            onNavigateToPost={onNavigateToPost}
            onNavigateToUser={onNavigateToUser}
            onClose={onClose}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
