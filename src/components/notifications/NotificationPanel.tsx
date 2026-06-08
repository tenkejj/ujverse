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
  onClearAll: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
  anchorRef?: RefObject<HTMLElement | null>
}

type Position = {
  top: number
  left: number
  caretLeft: number
  originX: number
}

const FALLBACK_POSITION: Position = {
  top: 64,
  left: 16,
  caretLeft: 190,
  originX: 50,
}

export default function NotificationPanel({
  notifications,
  loading,
  onMarkRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
  anchorRef,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const [position, setPosition] = useState<Position>(FALLBACK_POSITION)
  const [entered, setEntered] = useState(false)

  useLayoutEffect(() => {
    const updatePosition = () => {
      const panelWidth = 380
      const viewportGutter = 16
      const trigger = anchorRef?.current
      if (!trigger) {
        const center = window.innerWidth / 2
        const clampedCenter = Math.min(
          window.innerWidth - viewportGutter - panelWidth / 2,
          Math.max(viewportGutter + panelWidth / 2, center),
        )
        const left = clampedCenter - panelWidth / 2
        setPosition({
          top: FALLBACK_POSITION.top,
          left,
          caretLeft: panelWidth / 2,
          originX: 50,
        })
        return
      }

      const rect = trigger.getBoundingClientRect()
      const top = rect.bottom + 12
      const centerX = rect.left + rect.width / 2
      const minCenter = viewportGutter + panelWidth / 2
      const maxCenter = window.innerWidth - viewportGutter - panelWidth / 2
      const clampedCenter = Math.min(maxCenter, Math.max(minCenter, centerX))
      const panelLeft = clampedCenter - panelWidth / 2
      const caretLeft = Math.min(panelWidth - 20, Math.max(20, centerX - panelLeft))
      const originX = (caretLeft / panelWidth) * 100

      setPosition({ top, left: panelLeft, caretLeft, originX })
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
      className="fixed inset-0 z-210 hidden md:block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : motionPresets.backdropFade}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <motion.div
        className={`absolute flex w-[380px] max-h-[min(480px,calc(100vh-88px))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden ${notificationGlass.panelBase} ${entered ? notificationGlass.panelBlur : ''}`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
        transition={shouldReduceMotion ? { duration: 0.12 } : motionPresets.panelTween}
        onAnimationComplete={() => setEntered(true)}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-zinc-200 bg-white/85 dark:border-white/10 dark:bg-bg-card/95"
          style={{ left: `${position.caretLeft}px` }}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <NotificationList
            notifications={notifications}
            loading={loading}
            onMarkRead={onMarkRead}
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
