import { Heart, MessageCircle } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { AppNotification } from '../../types'
import { relativeTime } from '../../lib/utils'
import UserAvatar from '../UserAvatar'
import { getNotificationBadgeBackground } from './notification.theme'

type Props = {
  notif: AppNotification
  onMarkRead: (id: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
}

export default function NotificationItem({
  notif,
  onMarkRead,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
}: Props) {
  const actor = notif.actor ?? null
  const actorName = actor?.full_name ?? 'Ktoś'
  const actionText = notif.type === 'like' ? 'polubił(a) Twój wpis' : 'skomentował(a) Twój wpis'
  const badgeBg = getNotificationBadgeBackground(notif)

  const handleRowClick = () => {
    if (!notif.is_read) onMarkRead(notif.id)
    if (notif.post_id) onNavigateToPost(notif.post_id)
    onClose()
  }

  const handleActorClick = (e: MouseEvent<HTMLElement>) => {
    if (!notif.actor_id) return
    e.stopPropagation()
    onNavigateToUser(notif.actor_id)
    onClose()
  }

  return (
    <button
      type="button"
      data-notification-row="true"
      onClick={handleRowClick}
      className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] ${
        !notif.is_read ? 'bg-brand-gold/10 dark:bg-brand-gold-bright/10' : ''
      }`}
    >
      <div className="relative shrink-0">
        <button type="button" onClick={handleActorClick} className="rounded-full" aria-label={`Otwórz profil ${actorName}`}>
          <UserAvatar profile={actor} name={actorName} className="h-11 w-11 ring-1 ring-zinc-900/10 dark:ring-white/10" textSize="text-sm" />
        </button>
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm dark:border-[#0a0a0f]"
          style={{ background: badgeBg }}
          aria-hidden
        >
          {notif.type === 'like' ? (
            <Heart size={11} fill="currentColor" strokeWidth={0} className="text-white" />
          ) : (
            <MessageCircle size={11} strokeWidth={2.5} className="text-white" />
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-fg-primary">
          {notif.actor_id ? (
            <button type="button" onClick={handleActorClick} className="font-semibold hover:underline">
              {actorName}
            </button>
          ) : (
            <span className="font-semibold">{actorName}</span>
          )}{' '}
          <span className="text-fg-secondary">{actionText}</span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-500">{relativeTime(notif.created_at)}</p>
      </div>

      {!notif.is_read && (
        <span
          className="ml-2 h-2 w-2 shrink-0 rounded-full bg-brand-gold shadow-[0_0_10px_rgba(232,200,74,0.55)] dark:bg-brand-gold-bright"
          aria-hidden
        />
      )}
    </button>
  )
}
