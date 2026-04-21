import { Megaphone } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ACADEMIC_ISI_BADGE_LABEL,
  ACADEMIC_ISI_BADGE_TITLE,
  showAcademicIsiBadge,
} from '../lib/announcementBranding'
import {
  sectionTitleCls,
  sideMutedCls,
  widgetGoldCls,
} from '../lib/sidePanelStyles'
import BaseCard from './ui/BaseCard'
import type { AnnouncementMeta, AnnouncementStatus, UnifiedContent } from '../types/content'

const STATUS_META: Record<
  AnnouncementStatus,
  { label: string; dot: string; badge: string }
> = {
  cancelled: {
    label: 'Odwołane',
    dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
    badge: 'bg-[#1e293b]/10 text-[#1e293b] dark:text-red-400 border-[#1e293b]',
  },
  remote: {
    label: 'Zdalne',
    dot: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
    badge: 'bg-[#1e293b]/10 text-[#1e293b] dark:text-blue-300 border-[#1e293b]',
  },
  duty: {
    label: 'Dyżur',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]',
    badge: 'bg-[#1e293b]/10 text-[#1e293b] dark:text-emerald-300 border-[#1e293b]',
  },
}

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DAYS_TO_SHOW = 30

function getTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
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

function SkeletonBlock() {
  return (
    <BaseCard variant="inner" className="m-0 p-3 animate-pulse space-y-2">
      <div className="flex justify-between gap-2">
        <div className="h-4 rounded-md bg-black/10 dark:bg-white/10 w-2/5" />
        <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-16 shrink-0" />
      </div>
      <div className="h-5 w-20 rounded-full bg-black/10 dark:bg-white/10" />
      <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-full" />
      <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-4/5" />
    </BaseCard>
  )
}

type Props = {
  /** Komunikaty już przefiltrowane po wydziale (zrobione w `DataService.listAnnouncements`). */
  announcements: UnifiedContent<AnnouncementMeta>[]
  loading: boolean
  error: string | null
}

export default function AcademicAnnouncementsWidget({
  announcements,
  loading,
  error,
}: Props) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})

  const { visible, totalFiltered, olderCount } = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - DAYS_TO_SHOW)

    const recent = announcements.filter(
      (ann) => getTimestamp(ann.timestamp) >= cutoff.getTime(),
    )

    return {
      visible: recent,
      totalFiltered: announcements.length,
      olderCount: announcements.length - recent.length,
    }
  }, [announcements])

  useLayoutEffect(() => {
    if (import.meta.env.PROD) return
    console.debug('[AcademicAnnouncementsWidget] dataset check', {
      totalIncoming: announcements.length,
      totalFiltered,
      visibleCount: visible.length,
      olderCount,
      sortDescValid: visible.every(
        (item, index, arr) =>
          index === 0 || getTimestamp(arr[index - 1].timestamp) >= getTimestamp(item.timestamp),
      ),
    })
  }, [announcements.length, totalFiltered, visible, olderCount])

  return (
    <BaseCard variant="default" className="p-4 flex h-[600px] flex-col gap-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
        <span className={sectionTitleCls}>Komunikaty Akademickie</span>
      </div>

      {loading && (
        <div className="space-y-4">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-red-600 dark:text-red-400/90 leading-snug">{error}</p>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className={`text-xs ${sideMutedCls} leading-relaxed`}>
          Brak nowych komunikatów z ostatnich {DAYS_TO_SHOW} dni.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-8 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="h-auto space-y-4">
            <AnimatePresence mode="sync">
              {visible.map((ann, idx) => {
                const meta = STATUS_META[ann.metadata.status]
                const expanded = Boolean(expandedById[ann.id])
                return (
                  <motion.article
                    key={ann.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.24) }}
                    className="min-h-0"
                  >
                    <BaseCard variant="inner" className="m-0 p-3 min-h-0">
                      <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug min-w-0 break-words whitespace-normal">
                          {ann.author.displayName}
                        </p>
                        <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-0">
                          {showAcademicIsiBadge(ann.metadata.source) && (
                            <span
                              className="block text-[9px] font-medium leading-none whitespace-nowrap shrink-0 text-[#1e293b] dark:text-zinc-400 opacity-70 text-right"
                              title={ACADEMIC_ISI_BADGE_TITLE}
                            >
                              {ACADEMIC_ISI_BADGE_LABEL}
                            </span>
                          )}
                          {ann.timestamp && (
                            <time
                              dateTime={ann.timestamp}
                              className={`text-[10px] tabular-nums ${sideMutedCls}`}
                            >
                              {formatAnnDate(ann.timestamp)}
                            </time>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-block size-2 rounded-full shrink-0 ${meta.dot}`}
                          aria-hidden
                        />
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <AnnouncementBodyClamp
                        body={ann.body}
                        expanded={expanded}
                        onToggle={() =>
                          setExpandedById((p) => ({ ...p, [ann.id]: !p[ann.id] }))
                        }
                      />
                    </BaseCard>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </BaseCard>
  )
}
