/**
 * UJverse — CalendarFilters: filtry kindu + „tylko moi wykładowcy".
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Multi-select dla kindów: każdy pill jest niezależny, kliknięcie toggle'uje.
 * Brak wybranych pillów = pokazuj WSZYSTKIE kindy (a nie żadne) — to user
 * dziedziczy z większości UI nawigacji w UJverse („nic wybranego" === „all").
 *
 * „Tylko moi wykładowcy" używa `LecturerSubscriptionsContext` — nie wymaga
 * userId w props (provider montuje się raz w App.tsx). Gdy user nie ma żadnej
 * subskrypcji, toggle jest disabled z tooltipem.
 */
import { Filter, Users } from 'lucide-react'
import { FILTER_PILL } from '../../styles/mobile-theme'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  CALENDAR_ENTRY_KIND_LABEL,
  type CalendarEntryKind,
} from '../../types/calendar'
import { useLecturerSubscriptionsContext } from '../../lib/lecturerSubscriptionsContext'

/**
 * Kindy dostępne do filtrowania w UI. Świadomie pomijamy
 * `free_day`/`community_event`/`deadline` w v1 — nie generuje ich jeszcze
 * żaden trigger, więc pill bez ruchu UI = mylący.
 */
const FILTERABLE_KINDS: CalendarEntryKind[] = [
  'lecturer_absence',
  'class_cancelled',
  'class_remote',
  'class_rescheduled',
  'duty_change',
  'official_event',
]

type Props = {
  selectedKinds: ReadonlySet<CalendarEntryKind>
  onToggleKind: (kind: CalendarEntryKind) => void
  onlyMyLecturers: boolean
  onToggleOnlyMyLecturers: (next: boolean) => void
}

export default function CalendarFilters({
  selectedKinds,
  onToggleKind,
  onlyMyLecturers,
  onToggleOnlyMyLecturers,
}: Props) {
  const lecturerCtx = useLecturerSubscriptionsContext()
  const hasSubscriptions = (lecturerCtx?.subscribedKeys.size ?? 0) > 0
  const subscriptionsLoading = lecturerCtx?.loading ?? false

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-secondary">
        <Filter size={12} strokeWidth={2.25} aria-hidden />
        Filtry
      </span>

      {FILTERABLE_KINDS.map((kind) => {
        const active = selectedKinds.has(kind)
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggleKind(kind)}
            className={[
              FILTER_PILL.base,
              active ? FILTER_PILL.active : FILTER_PILL.inactive,
              'gap-1.5 text-xs px-3 py-1',
            ].join(' ')}
            aria-pressed={active}
          >
            <span
              aria-hidden
              className={`block h-1.5 w-1.5 rounded-full ${CALENDAR_ENTRY_KIND_COLORS[kind].dot}`}
            />
            {CALENDAR_ENTRY_KIND_LABEL[kind]}
          </button>
        )
      })}

      <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-white/10" aria-hidden />

      <button
        type="button"
        onClick={() => onToggleOnlyMyLecturers(!onlyMyLecturers)}
        disabled={!hasSubscriptions || subscriptionsLoading}
        title={
          subscriptionsLoading
            ? 'Ładuję twoje subskrypcje…'
            : !hasSubscriptions
              ? 'Najpierw zasubskrybuj wykładowcę dzwoneczkiem w komunikacie'
              : undefined
        }
        className={[
          FILTER_PILL.base,
          onlyMyLecturers ? FILTER_PILL.active : FILTER_PILL.inactive,
          'gap-1.5 text-xs px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40',
        ].join(' ')}
        aria-pressed={onlyMyLecturers}
      >
        <Users size={13} strokeWidth={2.25} aria-hidden />
        Tylko moi wykładowcy
      </button>
    </div>
  )
}
