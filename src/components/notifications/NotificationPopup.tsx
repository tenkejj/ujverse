import { useEffect } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import type { AppNotification } from '../../types'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import NotificationPanel from './NotificationPanel'
import NotificationSheet from './NotificationSheet'

type Props = {
  open: boolean
  onClose: () => void
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  anchorRef?: RefObject<HTMLElement | null>
}

export default function NotificationPopup({
  open,
  onClose,
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateToPost,
  onNavigateToUser,
  anchorRef,
}: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    if (!open) return

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open &&
        (isDesktop ? (
          <NotificationPanel
            notifications={notifications}
            loading={loading}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onClearAll={onClearAll}
            onNavigateToPost={onNavigateToPost}
            onNavigateToUser={onNavigateToUser}
            onClose={onClose}
            anchorRef={anchorRef}
          />
        ) : (
          <NotificationSheet
            notifications={notifications}
            loading={loading}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onClearAll={onClearAll}
            onNavigateToPost={onNavigateToPost}
            onNavigateToUser={onNavigateToUser}
            onClose={onClose}
          />
        ))}
    </AnimatePresence>,
    document.body,
  )
}
