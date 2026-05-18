import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
  anchorRef?: RefObject<HTMLElement | null>
}

type Position = {
  top: number
  right: number
}

const FALLBACK_POSITION: Position = {
  top: 64,
  right: 16,
}

export default function NotificationPanel({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
  anchorRef,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [position, setPosition] = useState<Position>(FALLBACK_POSITION)

  useLayoutEffect(() => {
    const updatePosition = () => {
      const trigger = anchorRef?.current
      if (!trigger) {
        setPosition(FALLBACK_POSITION)
        return
      }

      const rect = trigger.getBoundingClientRect()
      const top = rect.bottom + 12
      const right = Math.max(16, window.innerWidth - rect.right)
      setPosition({ top, right })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Powiadomienia"
      className="fixed inset-0 z-[210] hidden md:block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : motionPresets.backdropFade}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <motion.div
        className={`absolute w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden ${notificationGlass.panel}`}
        style={{
          top: `${position.top}px`,
          right: `${position.right}px`,
          maxHeight: 'min(640px, calc(100vh - 88px))',
        }}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={shouldReduceMotion ? { duration: 0.14 } : motionPresets.panelSpring}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-zinc-900/10 bg-white/85 dark:border-white/10 dark:bg-[#0a0a0f]/85" />
        <NotificationList
          notifications={notifications}
          loading={loading}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onClearAll={onClearAll}
          onNavigateToPost={onNavigateToPost}
          onNavigateToUser={onNavigateToUser}
          onClose={onClose}
        />
      </motion.div>
    </motion.div>
  )
}
