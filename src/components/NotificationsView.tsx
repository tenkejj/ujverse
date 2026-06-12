import type { ReactNode } from 'react'
import { AtSign, Bell, Check, CheckSquare, GraduationCap, Heart, MessageCircle, Megaphone, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { AppNotification } from '../types'
import { relativeTime } from '../lib/utils'
import UserAvatar from './UserAvatar'
import EmptyState from './EmptyState'
import BaseCard from './ui/BaseCard'
import { theme } from '../styles/theme'
import { PROFILE_MOBILE } from '../styles/mobile-theme'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../lib/announcementStatusStyles'

type Props = {
  notifications: AppNotification[]
  loading: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
  embedded?: boolean
  glassPanel?: boolean
  fullScreenModal?: boolean
  cleanOverlay?: boolean
}

/** Premium glass shell for standalone (mobile) route — room to breathe. */
const standaloneShell = `${PROFILE_MOBILE.card.glassClass} ${PROFILE_MOBILE.card.paddingXClass} py-8 sm:py-10`

/** Floating card: default BaseCard surface + extra glass polish. */
const floatingCardClass = [
  'w-full text-left border-white/10 shadow-sm dark:border-white/10 dark:shadow-lg',
  theme.colors.surface.glass,
  'backdrop-saturate-150',
  'transition-[transform,box-shadow,filter] duration-200 ease-out',
  'active:scale-[0.98]',
  '[-webkit-tap-highlight-color:transparent]',
].join(' ')

function ActionBadge({ type, clean }: { type: AppNotification['type']; clean?: boolean }) {
  if (clean) {
    const wrap =
      'absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border-app bg-black/[0.04] dark:border-white/12 dark:bg-white/[0.08]'
    if (type === 'like') {
      return (
        <span className={wrap} aria-hidden>
          <Heart size={12} className="text-brand-gold dark:text-brand-gold-bright" fill="currentColor" strokeWidth={0} />
        </span>
      )
    }
    if (type === 'reply_aula') {
      return (
        <span className={wrap} aria-hidden>
          <GraduationCap size={12} className="text-[#1e293b] dark:text-brand-gold-bright" strokeWidth={2.25} />
        </span>
      )
    }
    if (type === 'mention_aula') {
      return (
        <span className={wrap} aria-hidden>
          <AtSign size={12} className="text-[#1e293b] dark:text-brand-gold-bright" strokeWidth={2.25} />
        </span>
      )
    }
    if (type === 'lecturer_announcement') {
      return (
        <span className={wrap} aria-hidden>
          <Megaphone size={12} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
        </span>
      )
    }
    if (type === 'weekly_briefing') {
      return (
        <span className={wrap} aria-hidden>
          <Sparkles size={12} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
        </span>
      )
    }
    if (type === 'aula_task_new') {
      return (
        <span className={wrap} aria-hidden>
          <CheckSquare size={12} className="text-[#1e293b] dark:text-brand-gold-bright" strokeWidth={2.25} />
        </span>
      )
    }
    return (
      <span className={wrap} aria-hidden>
        <MessageCircle size={12} className="text-sky-500 dark:text-sky-400" strokeWidth={2.25} />
      </span>
    )
  }

  const base =
    'absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-md'

  if (type === 'like') {
    return (
      <span
        className={`${base} border-white bg-gradient-to-br from-[#a48955] to-[#7a6b45] dark:border-slate-950 dark:from-brand-gold-bright dark:to-amber-400`}
        aria-hidden
      >
        <Heart size={10} className="text-slate-900 dark:text-slate-950" fill="currentColor" strokeWidth={0} />
      </span>
    )
  }
  if (type === 'reply_aula') {
    return (
      <span className={`${base} border-white bg-slate-100 dark:border-slate-950 dark:bg-slate-800`} aria-hidden>
        <GraduationCap size={10} className="text-uj-blue dark:text-blue-400" strokeWidth={2.25} />
      </span>
    )
  }
  if (type === 'mention_aula') {
    return (
      <span className={`${base} border-white bg-slate-100 dark:border-slate-950 dark:bg-slate-800`} aria-hidden>
        <AtSign size={10} className="text-uj-blue dark:text-blue-400" strokeWidth={2.25} />
      </span>
    )
  }
  if (type === 'lecturer_announcement') {
    return (
      <span
        className={`${base} border-white bg-gradient-to-br from-[#a48955] to-[#7a6b45] dark:border-slate-950 dark:from-brand-gold-bright dark:to-amber-400`}
        aria-hidden
      >
        <Megaphone size={10} className="text-slate-900 dark:text-slate-950" strokeWidth={2.25} />
      </span>
    )
  }
  if (type === 'weekly_briefing') {
    return (
      <span
        className={`${base} border-white bg-gradient-to-br from-[#a48955] to-[#7a6b45] dark:border-slate-950 dark:from-brand-gold-bright dark:to-amber-400`}
        aria-hidden
      >
        <Sparkles size={10} className="text-slate-900 dark:text-slate-950" strokeWidth={2.25} />
      </span>
    )
  }
  if (type === 'aula_task_new') {
    return (
      <span className={`${base} border-white bg-slate-100 dark:border-slate-950 dark:bg-slate-800`} aria-hidden>
        <CheckSquare size={10} className="text-uj-blue dark:text-blue-400" strokeWidth={2.25} />
      </span>
    )
  }
  return (
    <span className={`${base} border-white bg-slate-100 dark:border-slate-950 dark:bg-slate-800`} aria-hidden>
      <MessageCircle size={10} className="text-uj-blue dark:text-blue-400" strokeWidth={2.25} />
    </span>
  )
}

function SkeletonRow({
  glassPanel,
  borderless,
  cleanOverlay,
}: {
  glassPanel?: boolean
  borderless?: boolean
  cleanOverlay?: boolean
}) {
  if (!glassPanel) {
    void borderless
    void cleanOverlay
    return (
      <BaseCard variant="default" flush className={`${floatingCardClass} pointer-events-none`}>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06] animate-pulse dark:bg-white/[0.08]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 max-w-[200px] w-3/4 rounded-full bg-black/[0.06] animate-pulse dark:bg-white/[0.08]" />
            <div className="h-2.5 w-1/3 rounded-full bg-black/[0.04] animate-pulse dark:bg-white/[0.05]" />
          </div>
        </div>
      </BaseCard>
    )
  }
  if (cleanOverlay) {
    return (
      <div className="flex items-center gap-3 border-b border-slate-200/60 py-3 dark:border-white/5">
        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200/80 animate-pulse dark:bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3 max-w-[200px] w-3/4 rounded-full bg-slate-200/80 animate-pulse dark:bg-white/10" />
          <div className="h-2.5 w-1/3 rounded-full bg-slate-100 animate-pulse dark:bg-white/5" />
        </div>
      </div>
    )
  }
  const border = borderless
    ? 'border-0 bg-transparent'
    : glassPanel
      ? 'border-white/10 bg-white/[0.04]'
      : 'border-slate-100 dark:border-border-app bg-card'
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${border}`}>
      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-full animate-pulse ${glassPanel ? 'bg-white/10' : 'bg-slate-200 dark:bg-white/10'}`} />
        <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full animate-pulse ${glassPanel ? 'bg-white/5' : 'bg-slate-100 dark:bg-white/5'}`} />
      </div>
      <div className="flex-1 space-y-2">
        <div className={`h-3 rounded-full animate-pulse w-3/4 ${glassPanel ? 'bg-white/15' : 'bg-slate-200 dark:bg-white/10'}`} />
        <div className={`h-2.5 rounded-full animate-pulse w-1/3 ${glassPanel ? 'bg-white/10' : 'bg-slate-100 dark:bg-white/5'}`} />
      </div>
    </div>
  )
}

function SectionLabel({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'earlier' }) {
  if (variant === 'earlier') {
    return (
      <p className={`mb-4 px-1 pt-3 text-[8px] font-bold uppercase tracking-[0.32em] text-brand-gold/45 dark:text-brand-gold-bright/40 first:pt-1`}>
        {children}
      </p>
    )
  }
  return (
    <p className="mb-4 px-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 first:pt-1 dark:text-slate-500">
      {children}
    </p>
  )
}

function SectionLabelGlass({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'earlier' }) {
  if (variant === 'earlier') {
    return (
      <p className="mb-1 px-1 pt-3 pb-1.5 text-[8px] font-bold uppercase tracking-[0.32em] text-brand-gold/50 first:pt-1">
        {children}
      </p>
    )
  }
  return (
    <p className="mb-1 px-1 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 first:pt-1">
      {children}
    </p>
  )
}

function SectionLabelClean({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'earlier' }) {
  const base =
    'mb-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 first:pt-0 dark:text-slate-500'
  if (variant === 'earlier') {
    return <p className={`${base} text-brand-gold/70 dark:text-brand-gold-bright/55`}>{children}</p>
  }
  return <p className={base}>{children}</p>
}

type CardProps = {
  notif: AppNotification
  onMarkRead: (id: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
  glassPanel?: boolean
  fullScreenModal?: boolean
  cleanOverlay?: boolean
}

type LecturerRowProps = {
  notif: AppNotification
  onOpen: () => void
  glassPanel?: boolean
  fullScreenModal?: boolean
  cleanOverlay?: boolean
}

function LecturerAnnouncementRow({
  notif,
  onOpen,
  glassPanel,
  fullScreenModal,
  cleanOverlay,
}: LecturerRowProps) {
  const ann = notif.announcement
  const lecturer = ann?.lecturer_name ?? 'Wykładowca'
  const status = ann?.status ?? null
  const preview = (ann?.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 180)
  const statusLabel = status ? ANNOUNCEMENT_STATUS_LABEL[status] : null
  const statusBadge = status ? ANNOUNCEMENT_STATUS_BADGE[status] : ''
  const statusDot = status ? ANNOUNCEMENT_STATUS_DOT[status] : ''

  if (glassPanel) {
    const cardGlass =
      glassPanel && fullScreenModal
        ? notif.is_read
          ? 'border-0 bg-transparent shadow-none hover:bg-brand-gold/5 rounded-none'
          : 'border-0 bg-white/[0.02] shadow-none hover:bg-brand-gold/5 rounded-none'
        : notif.is_read
          ? 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09]'
          : 'border-brand-gold/25 bg-brand-gold/[0.08] hover:bg-brand-gold/[0.12]'

    return (
      <button
        type="button"
        onClick={onOpen}
        className={`group relative flex w-full items-start gap-3 border px-4 py-3.5 text-left transition-all duration-300 ${
          fullScreenModal ? 'rounded-none' : 'rounded-2xl'
        } ${glassPanel && fullScreenModal ? '' : 'hover:shadow-lg hover:border-white/15'} ${cardGlass}`}
      >
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#a48955]/30 to-[#7a6b45]/15 ring-2 ring-white/90 dark:ring-slate-950">
            <GraduationCap size={18} className="text-brand-gold-bright" strokeWidth={2.25} />
          </div>
          <ActionBadge type={notif.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug">
            <span className="font-bold text-white">{lecturer}</span>{' '}
            {statusLabel && (
              <span className={`ml-1 inline-flex items-center gap-1 rounded-full border bg-transparent px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wide ${statusBadge}`}>
                <span className={`inline-block size-1.5 rounded-full ${statusDot}`} aria-hidden />
                {statusLabel}
              </span>
            )}
          </p>
          {preview && (
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-slate-300/85">{preview}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">{relativeTime(notif.created_at)}</p>
        </div>
      </button>
    )
  }

  void cleanOverlay

  const unreadRing = !notif.is_read
    ? 'ring-1 ring-[#1e293b]/12 dark:ring-brand-gold-bright/25'
    : ''

  return (
    <BaseCard
      as="button"
      type="button"
      variant="default"
      interactive
      flush
      onClick={onOpen}
      className={`${floatingCardClass} ${unreadRing}`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#a48955]/30 to-[#7a6b45]/15 ring-1 ring-border-app dark:ring-white/10">
            <GraduationCap size={18} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
          </div>
          <ActionBadge type={notif.type} clean />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] leading-snug ${theme.text.primary}`}>
            <span className="font-bold">{lecturer}</span>
            {statusLabel && (
              <span className={`ml-2 inline-flex items-center gap-1 rounded-full border bg-transparent px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wide ${statusBadge}`}>
                <span className={`inline-block size-1.5 rounded-full ${statusDot}`} aria-hidden />
                {statusLabel}
              </span>
            )}
          </p>
          {preview && (
            <p className={`mt-1 line-clamp-2 text-[12.5px] leading-snug ${theme.text.muted}`}>{preview}</p>
          )}
          <p className={`mt-1 text-xs ${theme.text.muted}`}>{relativeTime(notif.created_at)}</p>
        </div>
      </div>
    </BaseCard>
  )
}

function WeeklyBriefingRow({
  notif,
  onOpen,
  glassPanel,
  fullScreenModal,
  cleanOverlay,
}: LecturerRowProps) {
  // Soft contract z embedem `notif.briefing` — w MVP nie zaciągamy payloadu,
  // tylko CTA „otwórz briefing". Cała wartość liczbowa jest w widoku /briefing.
  const headline = 'Tygodniowy briefing jest gotowy'
  const subline = 'Plan tygodnia, odwołania, najbliższy egzamin i komunikaty od Twoich wykładowców.'

  if (glassPanel) {
    const cardGlass =
      glassPanel && fullScreenModal
        ? notif.is_read
          ? 'border-0 bg-transparent shadow-none hover:bg-brand-gold/5 rounded-none'
          : 'border-0 bg-white/[0.02] shadow-none hover:bg-brand-gold/5 rounded-none'
        : notif.is_read
          ? 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09]'
          : 'border-brand-gold/25 bg-brand-gold/[0.08] hover:bg-brand-gold/[0.12]'

    return (
      <button
        type="button"
        onClick={onOpen}
        className={`group relative flex w-full items-start gap-3 border px-4 py-3.5 text-left transition-all duration-300 ${
          fullScreenModal ? 'rounded-none' : 'rounded-2xl'
        } ${glassPanel && fullScreenModal ? '' : 'hover:shadow-lg hover:border-white/15'} ${cardGlass}`}
      >
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#a48955]/30 to-[#7a6b45]/15 ring-2 ring-white/90 dark:ring-slate-950">
            <Sparkles size={18} className="text-brand-gold-bright" strokeWidth={2.25} />
          </div>
          <ActionBadge type={notif.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-snug text-white">{headline}</p>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-slate-300/85">{subline}</p>
          <p className="mt-1 text-xs text-slate-500">{relativeTime(notif.created_at)}</p>
        </div>
      </button>
    )
  }

  void cleanOverlay

  const unreadRing = !notif.is_read
    ? 'ring-1 ring-[#1e293b]/12 dark:ring-brand-gold-bright/25'
    : ''

  return (
    <BaseCard
      as="button"
      type="button"
      variant="default"
      interactive
      flush
      onClick={onOpen}
      className={`${floatingCardClass} ${unreadRing}`}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#a48955]/30 to-[#7a6b45]/15 ring-1 ring-border-app dark:ring-white/10">
            <Sparkles size={18} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
          </div>
          <ActionBadge type={notif.type} clean />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-bold leading-snug ${theme.text.primary}`}>{headline}</p>
          <p className={`mt-1 line-clamp-2 text-[12.5px] leading-snug ${theme.text.muted}`}>{subline}</p>
          <p className={`mt-1 text-xs ${theme.text.muted}`}>{relativeTime(notif.created_at)}</p>
        </div>
      </div>
    </BaseCard>
  )
}

function NotificationRow({
  notif,
  onMarkRead,
  onNavigateToPost,
  onNavigateToUser,
  glassPanel,
  fullScreenModal,
  cleanOverlay,
}: CardProps) {
  const navigate = useNavigate()
  const actorProfile = notif.actor ?? null
  const actorName = actorProfile?.full_name ?? 'Ktoś'
  const actionText =
    notif.type === 'like'
      ? 'polubił(a) Twój wpis'
      : notif.type === 'reply_aula'
        ? 'odpowiedział(a) Ci w Auli'
        : notif.type === 'mention_aula'
          ? 'wspomniał(a) Cię w Auli'
          : notif.type === 'lecturer_announcement'
            ? 'nowy komunikat wykładowcy'
            : notif.type === 'weekly_briefing'
              ? 'Twój tygodniowy briefing'
              : notif.type === 'aula_task_new'
                ? notif.task?.title
                  ? `dodał(a) zadanie: ${notif.task.title}`
                  : 'dodał(a) nowe zadanie w Auli'
                : 'skomentował(a) Twój wpis'

  const handleOpen = () => {
    if (!notif.is_read) onMarkRead(notif.id)
    if (notif.type === 'reply_aula' || notif.type === 'mention_aula') {
      navigate(notif.cohort_message_id ? `/aula?message=${notif.cohort_message_id}` : '/aula')
      return
    }
    if (notif.type === 'lecturer_announcement') {
      navigate(notif.announcement_id ? `/moj-plan?announcement=${notif.announcement_id}` : '/moj-plan')
      return
    }
    if (notif.type === 'weekly_briefing') {
      navigate('/briefing')
      return
    }
    if (notif.type === 'aula_task_new') {
      navigate(notif.task_id ? `/aula?task=${notif.task_id}` : '/aula')
      return
    }
    if (notif.post_id) onNavigateToPost(notif.post_id)
  }

  // Powiadomienia od scrapera nie mają autora-osoby; renderujemy dedykowany
  // wiersz (lecturer + status badge + preview body) zamiast „Ktoś polubił".
  if (notif.type === 'lecturer_announcement') {
    return (
      <LecturerAnnouncementRow
        notif={notif}
        onOpen={handleOpen}
        glassPanel={glassPanel}
        fullScreenModal={fullScreenModal}
        cleanOverlay={cleanOverlay}
      />
    )
  }

  if (notif.type === 'weekly_briefing') {
    return (
      <WeeklyBriefingRow
        notif={notif}
        onOpen={handleOpen}
        glassPanel={glassPanel}
        fullScreenModal={fullScreenModal}
        cleanOverlay={cleanOverlay}
      />
    )
  }

  if (glassPanel) {
    const avatarGlow =
      notif.type === 'like'
        ? 'shadow-[0_0_14px_rgba(201,162,39,0.45)] dark:shadow-[0_0_16px_rgba(250,204,21,0.35)]'
        : 'shadow-[0_0_14px_rgba(59,130,246,0.35)] dark:shadow-[0_0_16px_rgba(96,165,250,0.3)]'

    const cardGlass =
      glassPanel && fullScreenModal
        ? notif.is_read
          ? 'border-0 bg-transparent shadow-none hover:bg-brand-gold/5 rounded-none'
          : 'border-0 bg-white/[0.02] shadow-none hover:bg-brand-gold/5 rounded-none'
        : glassPanel
          ? notif.is_read
            ? 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09]'
            : 'border-brand-gold/25 bg-brand-gold/[0.08] hover:bg-brand-gold/[0.12]'
          : ''

    const nameCls = `font-bold text-white ${onNavigateToUser ? 'cursor-pointer hover:underline decoration-white/40' : ''}`
    const bodyCls = 'text-slate-400'
    const timeCls = 'text-slate-500'

    return (
      <button
        type="button"
        onClick={handleOpen}
        className={`group relative w-full flex items-center gap-3 px-4 py-3.5 border text-left transition-all duration-300 ${
          fullScreenModal ? 'rounded-none' : 'rounded-2xl'
        } ${glassPanel && fullScreenModal ? '' : 'hover:shadow-lg hover:border-white/15'} ${cardGlass}`}
      >
        <div
          className="relative shrink-0 rounded-full"
          onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id!) } : undefined}
        >
          <UserAvatar
            profile={actorProfile}
            name={actorName}
            className={`h-10 w-10 ring-2 ring-white/90 dark:ring-slate-950 rounded-full transition-shadow duration-300 ${avatarGlow}`}
            textSize="text-sm"
          />
          <ActionBadge type={notif.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug">
            <span
              className={nameCls}
              onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id!) } : undefined}
            >
              {actorName}
            </span>{' '}
            <span className={bodyCls}>{actionText}</span>
          </p>
          <p className={`text-xs mt-0.5 ${timeCls}`}>{relativeTime(notif.created_at)}</p>
        </div>
      </button>
    )
  }

  void cleanOverlay

  const unreadRing =
    !notif.is_read
      ? 'ring-1 ring-[#1e293b]/12 dark:ring-brand-gold-bright/25'
      : ''

  return (
    <BaseCard
      as="button"
      type="button"
      variant="default"
      interactive
      flush
      onClick={handleOpen}
      className={`${floatingCardClass} ${unreadRing}`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div
          className="relative shrink-0"
          onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id!) } : undefined}
        >
          <UserAvatar
            profile={actorProfile}
            name={actorName}
            className="h-10 w-10 ring-1 ring-border-app dark:ring-white/10"
            textSize="text-sm"
          />
          <ActionBadge type={notif.type} clean />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] leading-snug ${theme.text.primary}`}>
            <span
              className={`font-semibold ${onNavigateToUser ? 'cursor-pointer group-hover:text-[#1e293b] dark:group-hover:text-brand-gold-bright' : ''}`}
              onClick={onNavigateToUser && notif.actor_id ? (e) => { e.stopPropagation(); onNavigateToUser(notif.actor_id!) } : undefined}
            >
              {actorName}
            </span>{' '}
            <span className={`font-normal ${theme.text.muted}`}>{actionText}</span>
          </p>
          <p className={`mt-1 text-xs ${theme.text.muted}`}>{relativeTime(notif.created_at)}</p>
        </div>
      </div>
    </BaseCard>
  )
}

const staggerStep = 0.042
const staggerStepFullscreen = 0.05

function rowTransition(delay: number, fullScreenModal?: boolean, cleanOverlay?: boolean) {
  if (cleanOverlay) {
    const d = delay + 0.04
    return {
      layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
      opacity: { duration: 0.32, delay: d },
      y: { duration: 0.36, delay: d, ease: [0.16, 1, 0.3, 1] as const },
      filter: { duration: 0.4, delay: d },
    }
  }
  if (fullScreenModal) {
    const d = delay + 0.1
    return {
      layout: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
      opacity: { duration: 0.48, delay: d },
      y: { duration: 0.52, delay: d, ease: [0.22, 1, 0.36, 1] as const },
      filter: { duration: 0.58, delay: d },
    }
  }
  return {
    layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
    opacity: { duration: 0.28, delay },
    y: { duration: 0.32, delay, ease: [0.16, 1, 0.3, 1] as const },
  }
}

export default function NotificationsView({
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onNavigateToPost,
  onNavigateToUser,
  embedded = false,
  glassPanel = false,
  fullScreenModal = false,
  cleanOverlay = false,
}: Props) {
  const hasUnread = notifications.some((n) => !n.is_read)
  const unreadList = notifications.filter((n) => !n.is_read)
  const readList = notifications.filter((n) => n.is_read)

  const SectionLabelCmp = cleanOverlay
    ? SectionLabelClean
    : glassPanel
      ? SectionLabelGlass
      : SectionLabel

  const useFloatingCards = !glassPanel

  if (loading) {
    const loadingInner = (
      <div className={useFloatingCards ? 'space-y-4' : 'space-y-0'}>
        {!embedded && (
          <div className="flex items-center justify-between px-1 pb-3">
            <h2 className={`text-[15px] font-bold ${theme.text.primary}`}>Powiadomienia</h2>
          </div>
        )}
        {[1, 2, 3, 4].map((i) => (
          <SkeletonRow
            key={i}
            glassPanel={glassPanel}
            borderless={fullScreenModal && glassPanel}
            cleanOverlay={cleanOverlay}
          />
        ))}
      </div>
    )
    if (embedded) return loadingInner
    return <div className={standaloneShell}>{loadingInner}</div>
  }

  if (notifications.length === 0) {
    if (cleanOverlay) {
      return (
        <motion.div
          className="flex flex-col items-center px-4 py-16 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 dark:border-brand-gold-bright/35 dark:bg-brand-gold/15">
            <Check className="h-7 w-7 text-brand-gold dark:text-brand-gold-bright" strokeWidth={2.25} />
          </div>
          <p className={`text-[17px] font-medium tracking-tight ${theme.text.primary}`}>Wszystko nadrobione!</p>
          <p className={`mt-1.5 max-w-[280px] text-[13px] leading-relaxed ${theme.text.muted}`}>
            Brak nowych powiadomień.
          </p>
        </motion.div>
      )
    }
    if (glassPanel) {
      return (
        <motion.div
          className="flex flex-col items-center py-14 px-4 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <Bell size={32} className="text-white/30" strokeWidth={1.35} />
          </div>
          <p className="text-[15px] font-semibold text-white/90">Brak powiadomień</p>
          <p className="mt-1 max-w-[240px] text-[13px] leading-relaxed text-slate-400">
            Gdy ktoś polubi lub skomentuje Twój wpis, zobaczysz to tutaj
          </p>
        </motion.div>
      )
    }
    const empty = (
      <EmptyState
        icon={Bell}
        title="Brak powiadomień"
        subtitle="Gdy ktoś polubi lub skomentuje Twój wpis, zobaczysz to tutaj"
      />
    )
    if (embedded) return empty
    return <div className={standaloneShell}>{empty}</div>
  }

  let staggerIndex = 0
  const step = fullScreenModal ? staggerStepFullscreen : staggerStep
  const itemInitial = cleanOverlay
    ? { opacity: 0, y: 12, filter: 'blur(8px)' }
    : fullScreenModal
      ? { opacity: 0, y: 36, filter: 'blur(10px)' }
      : { opacity: 0, y: 10 }

  const itemAnimate = cleanOverlay || fullScreenModal
    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
    : { opacity: 1, y: 0 }

  const listOuterCls = useFloatingCards
    ? 'space-y-8'
    : fullScreenModal || cleanOverlay
      ? 'space-y-0'
      : 'space-y-1'
  const sectionShell =
    useFloatingCards
      ? ''
      : fullScreenModal && !cleanOverlay
        ? 'overflow-hidden rounded-xl border border-brand-gold/10'
        : ''

  const rowDivider = (idx: number, len: number) =>
    !useFloatingCards && fullScreenModal && !cleanOverlay && idx < len - 1 ? 'border-b border-brand-gold/10' : ''

  const exitProps = cleanOverlay
    ? { opacity: 0, y: -6, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const } }
    : { opacity: 0, x: -14, transition: { duration: 0.22 } }

  const cardStackClass = useFloatingCards ? 'space-y-4' : ''

  const listBlock = (
    <div className={listOuterCls}>
      {unreadList.length > 0 && (
        <>
          <SectionLabelCmp>Nowe</SectionLabelCmp>
          <div className={`${sectionShell} ${cardStackClass}`.trim()}>
            <AnimatePresence mode="popLayout" initial={false}>
              {unreadList.map((notif, idx) => {
                const d = staggerIndex * step
                staggerIndex += 1
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    className={`w-full ${rowDivider(idx, unreadList.length)}`}
                    initial={itemInitial}
                    animate={itemAnimate}
                    exit={exitProps}
                    transition={rowTransition(d, fullScreenModal, cleanOverlay)}
                  >
                    <NotificationRow
                      notif={notif}
                      onMarkRead={onMarkRead}
                      onNavigateToPost={onNavigateToPost}
                      onNavigateToUser={onNavigateToUser}
                      glassPanel={glassPanel}
                      fullScreenModal={fullScreenModal}
                      cleanOverlay={cleanOverlay}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {readList.length > 0 && (
        <>
          <SectionLabelCmp variant="earlier">{glassPanel ? 'Wcześniejsze' : 'Starsze'}</SectionLabelCmp>
          <div className={`${sectionShell} ${cardStackClass}`.trim()}>
            <AnimatePresence mode="popLayout" initial={false}>
              {readList.map((notif, idx) => {
                const d = staggerIndex * step
                staggerIndex += 1
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    className={`w-full ${rowDivider(idx, readList.length)}`}
                    initial={itemInitial}
                    animate={itemAnimate}
                    exit={exitProps}
                    transition={rowTransition(d, fullScreenModal, cleanOverlay)}
                  >
                    <NotificationRow
                      notif={notif}
                      onMarkRead={onMarkRead}
                      onNavigateToPost={onNavigateToPost}
                      onNavigateToUser={onNavigateToUser}
                      glassPanel={glassPanel}
                      fullScreenModal={fullScreenModal}
                      cleanOverlay={cleanOverlay}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )

  if (embedded) {
    return listBlock
  }

  return (
    <div className={standaloneShell}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <h2 className={`text-[15px] font-bold ${theme.text.primary}`}>Powiadomienia</h2>
          {hasUnread && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200 ease-in-out ${theme.colors.border.gold} bg-[#1e293b]/10 text-[#1e293b] hover:bg-[#1e293b]/16 active:scale-[0.98] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/18`}
            >
              Oznacz wszystkie
            </button>
          )}
        </div>
        {listBlock}
      </div>
    </div>
  )
}
