import { Bell, Heart, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import EmptyState from './EmptyState'

type NotificationType = 'like' | 'comment'

type Notification = {
  id: number
  type: NotificationType
  authorName: string
  authorInitials: string
  text: string
  time: string
  read: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: 'like',
    authorName: 'Jan Kowalski',
    authorInitials: 'JK',
    text: 'polubił twój wpis',
    time: '2 min temu',
    read: false,
  },
  {
    id: 2,
    type: 'comment',
    authorName: 'Anna Nowak',
    authorInitials: 'AN',
    text: 'skomentowała twój wpis: "Świetna inicjatywa!"',
    time: '15 min temu',
    read: false,
  },
  {
    id: 3,
    type: 'like',
    authorName: 'Piotr Wiśniewski',
    authorInitials: 'PW',
    text: 'polubił twój wpis',
    time: '1 godz. temu',
    read: true,
  },
  {
    id: 4,
    type: 'comment',
    authorName: 'Marta Zielińska',
    authorInitials: 'MZ',
    text: 'skomentowała twój wpis: "Też tak myślę 😄"',
    time: '3 godz. temu',
    read: true,
  },
]

const SHOW_EMPTY = false

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === 'like') {
    return (
      <div className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
        <Heart size={14} className="text-red-500" fill="currentColor" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-full bg-uj-blue/8 dark:bg-uj-blue/15 flex items-center justify-center shrink-0">
      <MessageCircle size={14} className="text-uj-blue dark:text-blue-400" />
    </div>
  )
}

function AvatarPlaceholder({ initials }: { initials: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-uj-blue/10 dark:bg-white/10 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-uj-blue dark:text-gray-300">{initials}</span>
    </div>
  )
}

export default function NotificationsView() {
  if (SHOW_EMPTY || MOCK_NOTIFICATIONS.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Brak powiadomień"
        subtitle="Gdy coś się wydarzy, zobaczysz to tutaj"
      />
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-[15px] font-bold text-slate-800 dark:text-blue-50">Powiadomienia</h2>
        <span className="text-xs text-uj-blue dark:text-uj-orange font-medium cursor-pointer hover:underline">
          Oznacz wszystkie jako przeczytane
        </span>
      </div>

      {MOCK_NOTIFICATIONS.map((notif, idx) => (
        <motion.div
          key={notif.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.05 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
            notif.read
              ? 'bg-white dark:bg-dark-card border-slate-100 dark:border-white/5'
              : 'bg-uj-blue/5 dark:bg-uj-orange/5 border-uj-blue/10 dark:border-uj-orange/10'
          }`}
        >
          <div className="relative">
            <AvatarPlaceholder initials={notif.authorInitials} />
            <div className="absolute -bottom-0.5 -right-0.5">
              <NotificationIcon type={notif.type} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] text-slate-700 dark:text-gray-200 leading-snug">
              <span className="font-semibold">{notif.authorName}</span>{' '}
              <span className="text-slate-500 dark:text-gray-400">{notif.text}</span>
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{notif.time}</p>
          </div>

          {!notif.read && (
            <div className="w-2.5 h-2.5 rounded-full bg-uj-blue dark:bg-uj-orange shrink-0" />
          )}
        </motion.div>
      ))}
    </div>
  )
}
