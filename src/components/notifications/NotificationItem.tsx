import { AtSign, GraduationCap, Heart, MessageCircle } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppNotification } from '../../types'
import { relativeTime } from '../../lib/utils'
import UserAvatar from '../UserAvatar'
import { getNotificationBadgeBackground } from './notification.theme'

type Props = {
  notif: AppNotification
  isLastInList?: boolean
  onMarkRead: (id: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser: (userId: string) => void
  onClose: () => void
}

export default function NotificationItem({
  notif,
  isLastInList = false,
  onMarkRead,
  onNavigateToPost,
  onNavigateToUser,
  onClose,
}: Props) {
  const navigate = useNavigate()
  const actor = notif.actor ?? null
  const actorName = actor?.full_name ?? 'Ktoś'
  const actionText =
    notif.type === 'like'
      ? 'polubił(a) Twój wpis'
      : notif.type === 'reply_aula'
        ? 'odpowiedział(a) Ci w Auli'
        : notif.type === 'mention_aula'
          ? 'wspomniał(a) Cię w Auli'
          : 'skomentował(a) Twój wpis'
  const badgeBg = getNotificationBadgeBackground(notif)

  const isAulaType = notif.type === 'reply_aula' || notif.type === 'mention_aula'

  const handleRowClick = () => {
    if (!notif.is_read) onMarkRead(notif.id)
    if (isAulaType) {
      const target = notif.cohort_message_id
        ? `/aula?message=${notif.cohort_message_id}`
        : '/aula'
      navigate(target)
    } else if (notif.post_id) {
      onNavigateToPost(notif.post_id)
    }
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
      className={`group relative flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left font-sans transition-colors dark:border-white/5 dark:bg-bg-card/95 dark:hover:bg-white/5 ${
        !notif.is_read ? 'bg-brand-gold/10 hover:bg-brand-gold/14 dark:bg-bg-card/95' : 'hover:bg-black/4'
      } ${isLastInList ? 'border-b-0' : ''}`}
    >
      <div className="relative shrink-0">
        <button type="button" onClick={handleActorClick} className="rounded-full" aria-label={`Otwórz profil ${actorName}`}>
          <UserAvatar profile={actor} name={actorName} className="h-11 w-11 ring-1 ring-zinc-900/10 dark:ring-white/10" textSize="text-sm" />
        </button>
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white p-0 shadow-sm dark:border-[#0a0a0f]"
          style={{ background: badgeBg }}
          aria-hidden
        >
          {notif.type === 'like' ? (
            <Heart size={10} fill="currentColor" strokeWidth={0} className="block text-white" />
          ) : notif.type === 'reply_aula' ? (
            <GraduationCap size={11} strokeWidth={2.5} className="block text-white" />
          ) : notif.type === 'mention_aula' ? (
            <AtSign size={11} strokeWidth={2.5} className="block text-white" />
          ) : (
            <MessageCircle size={10} strokeWidth={2.5} className="block translate-x-[0.5px] translate-y-[0.5px] text-white" />
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-sans text-[13.5px] leading-snug text-fg-primary">
          {notif.actor_id ? (
            <button type="button" onClick={handleActorClick} className="font-semibold hover:underline">
              {actorName}
            </button>
          ) : (
            <span className="font-semibold">{actorName}</span>
          )}{' '}
          <span className="text-fg-secondary">{actionText}</span>
        </p>
        <p className="mt-0.5 font-sans text-[11.5px] leading-normal text-zinc-500 dark:text-zinc-500">{relativeTime(notif.created_at)}</p>
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
