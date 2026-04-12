import { Megaphone } from 'lucide-react'
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { canonicalDepartment } from '../lib/departments'
import { useAnnouncements } from '../hooks/useAnnouncements'
import type { AcademicAnnouncement, AnnouncementStatus } from '../types'

const widgetGoldCls = 'text-[#a48955] dark:text-brand-gold-bright'

const sideCardCls =
  'rounded-2xl border border-[#0f172a]/5 bg-card shadow-sm p-4 dark:border-white/5 dark:bg-bg-card/40 dark:backdrop-blur-md dark:shadow-none'

const sectionTitleCls = 'font-bold text-[10px] uppercase tracking-[0.2em] text-brand-gold'

const sideMutedCls = 'text-logo-navy/60 dark:text-slate-400'

const announcementCardCls =
  'rounded-2xl border border-[#0f172a]/8 bg-white/[0.45] p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]'

const STATUS_META: Record<
  AnnouncementStatus,
  { label: string; dot: string; badge: string }
> = {
  cancelled: {
    label: 'Odwołane',
    dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  },
  remote: {
    label: 'Zdalne',
    dot: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  },
  duty: {
    label: 'Dyżur',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]',
    badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
  },
}

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function filterByDepartment(
  items: AcademicAnnouncement[],
  selectedDepartment: string,
): AcademicAnnouncement[] {
  if (!selectedDepartment.trim()) return items
  const sel = canonicalDepartment(selectedDepartment)
  if (!sel) return items
  return items.filter((a) => {
    const rowDept = canonicalDepartment(a.department)
    if (rowDept == null) return true
    return rowDept === sel
  })
}

const MAX_VISIBLE = 12

function SkeletonBlock() {
  return (
    <div className={`${announcementCardCls} animate-pulse space-y-2`}>
      <div className="flex justify-between gap-2">
        <div className="h-4 rounded-md bg-black/10 dark:bg-white/10 w-2/5" />
        <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-16 shrink-0" />
      </div>
      <div className="h-5 w-20 rounded-full bg-black/10 dark:bg-white/10" />
      <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-full" />
      <div className="h-3 rounded-md bg-black/10 dark:bg-white/10 w-4/5" />
    </div>
  )
}

type Props = {
  selectedDepartment: string
}

export default function AcademicAnnouncementsWidget({ selectedDepartment }: Props) {
  const { announcements, loading, error } = useAnnouncements()

  const visible = useMemo(() => {
    const filtered = filterByDepartment(announcements, selectedDepartment)
    return filtered.slice(0, MAX_VISIBLE)
  }, [announcements, selectedDepartment])

  return (
    <div className={sideCardCls}>
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
          Brak komunikatów dla aktualnego filtra.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence mode="sync">
            {visible.map((ann, idx) => {
              const meta = STATUS_META[ann.status]
              return (
                <motion.article
                  key={ann.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.24) }}
                  className={announcementCardCls}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-[#1e293b] dark:text-white leading-snug min-w-0">
                      {ann.lecturer_name}
                    </p>
                    <time
                      dateTime={ann.created_at}
                      className={`text-[10px] tabular-nums shrink-0 pt-0.5 ${sideMutedCls}`}
                    >
                      {formatAnnDate(ann.created_at)}
                    </time>
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
                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {ann.body}
                  </p>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
