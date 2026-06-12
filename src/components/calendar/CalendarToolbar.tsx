/**
 * UJverse — CalendarToolbar: nawigacja miesiącami + przycisk „Dziś".
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatMonthLabel } from '../../lib/calendarGrid'

type Props = {
  viewMonth: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  /** Czy `viewMonth` to bieżący miesiąc — wtedy „Dziś" jest disabled. */
  isCurrentMonth: boolean
}

export default function CalendarToolbar({
  viewMonth,
  onPrev,
  onNext,
  onToday,
  isCurrentMonth,
}: Props) {
  const label = formatMonthLabel(viewMonth)
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2 className="text-xl font-bold tracking-tight text-fg-primary first-letter:uppercase">
        {label}
      </h2>
      <div className="flex items-center gap-1.5">
        <motion.button
          type="button"
          onClick={onPrev}
          whileTap={{ scale: 0.92 }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/5"
          aria-label="Poprzedni miesiąc"
        >
          <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
        </motion.button>
        <button
          type="button"
          onClick={onToday}
          disabled={isCurrentMonth}
          className="rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-default disabled:opacity-50 enabled:hover:border-[#1e293b]/45 enabled:hover:text-[#1e293b] dark:enabled:hover:border-[#D4AF37]/60 dark:enabled:hover:text-[#D4AF37] border-zinc-200 text-zinc-600 dark:border-white/10 dark:text-zinc-200"
        >
          Dziś
        </button>
        <motion.button
          type="button"
          onClick={onNext}
          whileTap={{ scale: 0.92 }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/5"
          aria-label="Następny miesiąc"
        >
          <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
        </motion.button>
      </div>
    </div>
  )
}
