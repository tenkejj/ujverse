import { useLayoutEffect, useRef, useState } from 'react'
import {
  ACADEMIC_ISI_BADGE_LABEL,
  ACADEMIC_ISI_BADGE_TITLE,
  showAcademicIsiBadge,
} from '../../lib/announcementBranding'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../../lib/announcementStatusStyles'
import { sideMutedCls } from '../../lib/sidePanelStyles'
import type { AnnouncementMeta, UnifiedContent } from '../../types/content'
import BaseCard from '../ui/BaseCard'

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AnnouncementBodyClamp({
  body,
  expanded,
  onToggle,
}: {
  body: string
  expanded: boolean
  onToggle: () => void
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (expanded) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [body, expanded])

  return (
    <div className="min-h-0">
      <p
        ref={ref}
        className={`text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap break-words ${
          expanded ? '' : 'line-clamp-4'
        }`}
      >
        {body}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1.5 text-xs font-medium ${sideMutedCls} hover:text-logo-navy/80 dark:hover:text-slate-300 transition-colors`}
        >
          {expanded ? 'zwiń' : 'rozwiń'}
        </button>
      )}
    </div>
  )
}

type Props = {
  announcement: UnifiedContent<AnnouncementMeta>
  expanded?: boolean
  onToggleExpand?: () => void
  /** Gdy podane — cała karta jest klikalna (np. wyniki wyszukiwania). */
  onOpen?: () => void
  className?: string
}

export default function AnnouncementCard({
  announcement,
  expanded: expandedProp,
  onToggleExpand,
  onOpen,
  className = '',
}: Props) {
  const [expandedLocal, setExpandedLocal] = useState(false)
  const expanded = expandedProp ?? expandedLocal
  const toggleExpand =
    onToggleExpand ??
    (() => {
      setExpandedLocal((v) => !v)
    })

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug min-w-0 break-words whitespace-normal">
          {announcement.author.displayName}
        </p>
        <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-0">
          {showAcademicIsiBadge(announcement.metadata.source) && (
            <span
              className="block text-[9px] font-medium leading-none whitespace-nowrap shrink-0 text-[#1e293b] dark:text-zinc-400 opacity-70 text-right"
              title={ACADEMIC_ISI_BADGE_TITLE}
            >
              {ACADEMIC_ISI_BADGE_LABEL}
            </span>
          )}
          {announcement.timestamp && (
            <time
              dateTime={announcement.timestamp}
              className={`text-[10px] tabular-nums ${sideMutedCls}`}
            >
              {formatAnnDate(announcement.timestamp)}
            </time>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block size-2 rounded-full shrink-0 ${ANNOUNCEMENT_STATUS_DOT[announcement.metadata.status]}`}
          aria-hidden
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-transparent ${ANNOUNCEMENT_STATUS_BADGE[announcement.metadata.status]}`}
        >
          {ANNOUNCEMENT_STATUS_LABEL[announcement.metadata.status]}
        </span>
      </div>
      <AnnouncementBodyClamp body={announcement.body} expanded={expanded} onToggle={toggleExpand} />
    </>
  )

  if (onOpen) {
    return (
      <BaseCard
        as="button"
        type="button"
        variant="inner"
        interactive
        onClick={onOpen}
        className={`m-0 p-3 min-h-0 w-full text-left ${className}`}
      >
        {inner}
      </BaseCard>
    )
  }

  return (
    <BaseCard variant="inner" className={`m-0 p-3 min-h-0 ${className}`}>
      {inner}
    </BaseCard>
  )
}
