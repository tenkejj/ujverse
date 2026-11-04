/**
 * Wspólne klocki widoków informacyjnych — ten sam język wizualny co boczne
 * widżety feedu (BaseCard + nagłówki sekcji w kolorze marki).
 */
import { useId, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { AlertTriangle, ArrowUpRight, Bookmark, BookmarkCheck, Inbox, RotateCcw } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { Skeleton } from '../ui/Skeleton'
import { sectionTitleCls, sideMutedCls, widgetGoldCls } from '../../lib/sidePanelStyles'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../../lib/announcementStatusStyles'
import type { AnnouncementStatus } from '../../types/content'
import { formatFull, formatRelativePast, parseIsoDate } from '../../lib/info/time'
import type { InfoItem } from '../../lib/info/types'
import { toggleSavedInfoItem, useInfoStore } from '../../hooks/useInfoPreferences'
import { isSaved } from '../../lib/info/saved'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/35 dark:focus-visible:ring-brand-gold/45'

export const INFO_TITLE_CLS = 'text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100'
export const INFO_META_CLS = 'text-[11px] leading-snug text-zinc-500 dark:text-zinc-400'
export const INFO_TEXT_CLS = 'text-xs leading-relaxed text-zinc-600 dark:text-zinc-400'

export const INFO_LINK_CLS =
  `inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright ${FOCUS_RING}`

export const INFO_ACTION_LINK_CLS =
  `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-logo-navy/70 transition-colors hover:bg-black/[0.04] hover:text-brand-ink dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-brand-gold-bright ${FOCUS_RING}`

export const INFO_ROW_CLS = 'm-0 min-w-0 p-3'

export function InfoSection({
  icon: SectionIcon,
  title,
  subtitle,
  action,
  children,
  className = '',
  busy = false,
}: {
  icon: Icon
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  busy?: boolean
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} aria-busy={busy || undefined} className={`min-w-0 ${className}`}>
      <BaseCard variant="default" className="flex h-full min-w-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-2">
          <SectionIcon size={14} strokeWidth={2} className={`${widgetGoldCls} shrink-0`} aria-hidden />
          <h2 id={headingId} className={`${sectionTitleCls} min-w-0 flex-1 truncate`}>
            {title}
          </h2>
          {action}
        </div>
        {subtitle ? <div className={`-mt-1 text-xs ${sideMutedCls}`}>{subtitle}</div> : null}
        {children}
      </BaseCard>
    </section>
  )
}

export function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <BaseCard key={i} variant="inner" className="space-y-2 p-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </BaseCard>
      ))}
    </div>
  )
}

/** Błąd źródła — nigdy nie udaje pustej listy. */
export function DomainError({
  what,
  onRetry,
}: {
  what: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-3 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/[0.07] dark:text-amber-100"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">Nie udało się pobrać: {what}.</p>
        <p className="mt-0.5 text-xs opacity-80">
          To problem z połączeniem lub serwerem, a nie brak informacji. Pozostałe sekcje działają niezależnie.
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/10 ${FOCUS_RING}`}
        >
          <RotateCcw size={13} aria-hidden />
          Ponów
        </button>
      ) : null}
    </div>
  )
}

export function DomainEmpty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-zinc-200 p-3 dark:border-white/10">
      <Inbox size={16} className={`mt-0.5 shrink-0 ${sideMutedCls}`} aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className={INFO_TEXT_CLS}>{children}</p>
        {action}
      </div>
    </div>
  )
}

export function ExternalSourceLink({
  href,
  children,
  className = '',
  title,
}: {
  href: string | null
  children: ReactNode
  className?: string
  title?: string
}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`${INFO_LINK_CLS} ${className}`.trim()}
    >
      {children}
      <ArrowUpRight size={12} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">(otwiera się w nowej karcie)</span>
    </a>
  )
}

/** Znacznik czasu z jawnym znaczeniem w `title` (np. „Dodano do UJverse"). */
export function TimeStamp({
  iso,
  prefix,
  meaning,
  now,
}: {
  iso: string | null
  prefix: string
  meaning: string
  now?: Date
}) {
  const date = parseIsoDate(iso)
  if (!date) return null
  return (
    <time dateTime={date.toISOString()} title={`${meaning}: ${formatFull(date)}`}>
      {prefix} {formatRelativePast(date, now)}
    </time>
  )
}

/** Pigułka statusu — tylko dla statusów niosących informację (bez „Komunikat"). */
export function AnnouncementStatusPill({ status }: { status: AnnouncementStatus }) {
  if (status === 'info') return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ANNOUNCEMENT_STATUS_BADGE[status]}`}
    >
      <span className={`inline-block size-1.5 rounded-full ${ANNOUNCEMENT_STATUS_DOT[status]}`} aria-hidden />
      {status === 'cancelled' ? 'Odwołane zajęcia' : ANNOUNCEMENT_STATUS_LABEL[status]}
    </span>
  )
}

export function SaveToggle({ item, className = '' }: { item: InfoItem; className?: string }) {
  const { saved } = useInfoStore()
  const active = isSaved(saved, item.kind, item.id)
  const Glyph = active ? BookmarkCheck : Bookmark
  return (
    <button
      type="button"
      onClick={() => toggleSavedInfoItem(item)}
      aria-pressed={active}
      aria-label={active ? `Usuń z zapisanych: ${item.title}` : `Zapisz na później: ${item.title}`}
      title={active ? 'Usuń z zapisanych' : 'Zapisz na później (na tym urządzeniu)'}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
        active
          ? 'text-brand-ink dark:text-brand-gold-bright'
          : 'text-zinc-400 hover:bg-black/[0.04] hover:text-brand-ink dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-brand-gold-bright'
      } ${FOCUS_RING} ${className}`.trim()}
    >
      <Glyph size={16} strokeWidth={2} aria-hidden />
    </button>
  )
}

export function PageIntro({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold leading-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  )
}
