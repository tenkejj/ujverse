import { Bell, ChevronRight, Heart, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import type { AppNotification } from '../types'
import { relativeTime } from '../lib/utils'
import UserAvatar from './UserAvatar'
import EmptyState from './EmptyState'

type Props = {
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
}

function NotificationIcon({ type }: { type: 'like' | 'comment' }) {
  if (type === 'like') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
        <Heart size={12} className="text-red-500" fill="currentColor" />
      </div>
    )
  }
  return (
    <div className="w-6 h-6 rounded-full bg-uj-blue/8 dark:bg-uj-blue/15 flex items-center justify-center shrink-0">
      <MessageCircle size={12} className="text-uj-blue dark:text-blue-400" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-dark-card">
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse" />
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse w-3/4" />
        <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded-full animate-pulse w-1/3" />
      </div>
    </div>
  )
}

export default function NotificationsView({ notifications, loading, onMarkRead, onMarkAllRead, onNavigateToPost, onNavigateToUser }: Props) {
  const hasUnread = notifications.some((n) => !n.is_read)

  if (loading) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-[15px] font-bold text-slate-800 dark:text-blue-50">Powiadomienia</h2>
        </div>
        {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Brak powiadomień"
        subtitle="Gdy ktoś polubi lub skomentuje Twój wpis, zobaczysz to tutaj"
      />
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-[15px] font-bold text-slate-800 dark:text-blue-50">Powiadomienia</h2>
        {hasUnread && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs text-uj-blue dark:text-uj-orange font-medium hover:underline transition-colors"
          >
            Oznacz wszystkie jako przeczytane
          </button>
        )}
      </div>

      {notifications.map((notif, idx) => {
        const actorProfile = notif.actor ?? null
        const actorName = actorProfile?.full_name ?? 'Ktoś'
        const actionText = notif.type === 'like' ? 'polubił(a) Twój wpis' : 'skomentował(a) Twój wpis'

        return (
          <motion.button
            key={notif.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.3) }}
            onClick={() => {
              if (!notif.is_read) onMarkRead(notif.id)
              if (notif.post_id) onNavigateToPost(notif.post_id)
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors hover:bg-slate-50 dark:hover:bg-white/5 text-left ${
              notif.is_read
                ? 'bg-white dark:bg-dark-card border-slate-100 dark:border-white/5'
                : 'bg-uj-blue/5 dark:bg-uj-orange/5 border-uj-blue/10 dark:border-uj-orange/10'
            }`}
          >
            <div
              className="relative shrink-0"
              onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id) } : undefined}
            >
              <UserAvatar profile={actorProfile} name={actorName} className="h-10 w-10" textSize="text-sm" />
              <div className="absolute -bottom-0.5 -right-0.5">
                <NotificationIcon type={notif.type} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] text-slate-700 dark:text-gray-200 leading-snug">
                <span
                  className={`font-semibold ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id) } : undefined}
                >{actorName}</span>{' '}
                <span className="text-slate-500 dark:text-gray-400">{actionText}</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                {relativeTime(notif.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!notif.is_read && (
                <div className="w-2.5 h-2.5 rounded-full bg-uj-blue dark:bg-uj-orange" />
              )}
              {notif.post_id && (
                <ChevronRight size={14} className="text-slate-300 dark:text-gray-600" />
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
