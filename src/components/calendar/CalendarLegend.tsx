/**
 * UJverse — CalendarLegend: legenda kolorów kindów (collapsible na mobile).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 */
import {
  CALENDAR_ENTRY_KIND_COLORS,
  CALENDAR_ENTRY_KIND_LABEL,
  type CalendarEntryKind,
} from '../../types/calendar'

/**
 * Kindy widoczne w v1 — pomijamy te, których jeszcze nie generuje żaden
 * trigger (free_day, community_event, deadline). Gdy dojdzie kolejne źródło,
 * dopisujemy tu i tylko tu.
 */
const VISIBLE_KINDS: CalendarEntryKind[] = [
  'lecturer_absence',
  'class_cancelled',
  'class_remote',
  'class_rescheduled',
  'duty_change',
  'official_event',
]

export default function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-bg-card/60">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-secondary">
        Legenda
      </span>
      {VISIBLE_KINDS.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={`block h-2 w-2 rounded-full ${CALENDAR_ENTRY_KIND_COLORS[kind].dot}`}
          />
          <span className="text-[11px] font-medium text-fg-secondary">
            {CALENDAR_ENTRY_KIND_LABEL[kind]}
          </span>
        </span>
      ))}
    </div>
  )
}
