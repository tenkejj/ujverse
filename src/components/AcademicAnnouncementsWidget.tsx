import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ACTIVE_ANNOUNCEMENT_DAYS } from '../lib/announcementRecency'
import {
  ACADEMIC_ISI_BADGE_LABEL,
  ACADEMIC_ISI_BADGE_TITLE,
} from '../lib/announcementBranding'
import {
  sectionTitleCls,
  sideMutedCls,
  widgetGoldCls,
} from '../lib/sidePanelStyles'
import AnnouncementCard from './announcements/AnnouncementCard'
import BaseCard from './ui/BaseCard'
import type { AnnouncementMeta, UnifiedContent } from '../types/content'

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
  /**
   * Override domyślnej klasy wysokości wyspy. Default `h-[600px]` używamy gdy
   * widget żyje samodzielnie; gdy parent (FeedView) wyrównuje wyspy lewej
   * kolumny do wysokości prawego asiede, podaje tu `h-full` i kontroluje
   * rozmiar wrapperem (flex basis).
   */
  heightClassName?: string
}

export default function AcademicAnnouncementsWidget({
  announcements,
  loading,
  error,
  heightClassName = 'h-[600px]',
}: Props) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})

  // Recency cutoff jest teraz wymuszony przez `AnnouncementsAdapter`
  // (.gte('created_at', activeAnnouncementCutoff())), więc tu nie filtrujemy
  // ponownie — dane przychodzą już ograniczone do ostatnich
  // ACTIVE_ANNOUNCEMENT_DAYS dni i identyczne dla desktopu i mobila.
  const visible = announcements

  return (
    <BaseCard
      variant="default"
      className={`p-4 flex ${heightClassName} min-h-0 flex-col gap-4 overflow-hidden`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Megaphone size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={sectionTitleCls}>Komunikaty Akademickie</span>
          <span
            className={`text-[10px] ${sideMutedCls}`}
            title={ACADEMIC_ISI_BADGE_TITLE}
          >
            {ACADEMIC_ISI_BADGE_LABEL}
          </span>
        </div>
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
          Brak nowych komunikatów z ostatnich {ACTIVE_ANNOUNCEMENT_DAYS} dni.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-8 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="h-auto space-y-4">
            <AnimatePresence mode="sync">
              {visible.map((ann, idx) => {
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
                    <AnnouncementCard
                      announcement={ann}
                      expanded={expanded}
                      onToggleExpand={() =>
                        setExpandedById((p) => ({ ...p, [ann.id]: !p[ann.id] }))
                      }
                    />
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
