/**
 * UJverse — MiejscaSideRail: boczna kolumna na desktop dla `/miejsca`.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * 1:1 z `EventsSideRail` (same panele/style z `EVENTS_HUB.rail`):
 *   1. **Live presence** — zielony status "Live · {N} osób się teraz uczy".
 *   2. **Statystyki** — 3 cyfry (miejsca, live, średnia ocena).
 *   3. **Filtruj typ** — pionowa lista typów miejsc + licznik.
 */
import { motion } from 'framer-motion'
import { Activity, BarChart3, Filter } from 'lucide-react'
import { EVENTS_HUB } from '../../styles/mobile-theme'

export type SideRailKindFilter = {
  key: string
  label: string
  count: number
}

export type StudySpotStats = {
  total: number
  liveCount: number
  avgRating: number | null
}

type Props = {
  stats: StudySpotStats
  filters: SideRailKindFilter[]
  activeFilterKey: string
  onFilterChange: (key: string) => void
}

const R = EVENTS_HUB.rail

export default function MiejscaSideRail({
  stats,
  filters,
  activeFilterKey,
  onFilterChange,
}: Props) {
  return (
    <motion.aside
      variants={EVENTS_HUB.motion.page}
      initial="hidden"
      animate="show"
      className={R.wrapClass}
      aria-label="Panel boczny miejsc do nauki"
    >
      <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
        <h3 className={R.panelTitleClass}>
          <Activity size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
          Live presence
        </h3>
        <div className={R.liveRowClass} role="status">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                stats.liveCount > 0 ? 'animate-ping bg-emerald-400 opacity-60' : 'bg-zinc-300'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                stats.liveCount > 0 ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
          </span>
          <span>
            {stats.liveCount > 0 ? (
              <>
                <strong className="tabular-nums">{stats.liveCount}</strong>{' '}
                {stats.liveCount === 1 ? 'osoba uczy' : 'osób uczy'} się teraz w {' '}
                <strong className="tabular-nums">
                  {Math.min(stats.liveCount, stats.total)}
                </strong>{' '}
                miejsc
              </>
            ) : (
              <>Nikt teraz nie jest zameldowany — bądź pierwszy</>
            )}
          </span>
        </div>
      </motion.div>

      <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
        <h3 className={R.panelTitleClass}>
          <BarChart3 size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
          Statystyki
        </h3>
        <div className={R.statsGridClass}>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>{stats.total}</span>
            <span className={R.statLabelClass}>Miejsc</span>
          </div>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>{stats.liveCount}</span>
            <span className={R.statLabelClass}>Live</span>
          </div>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>
              {stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
            </span>
            <span className={R.statLabelClass}>Ocena</span>
          </div>
        </div>
      </motion.div>

      {filters.length > 0 && (
        <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
          <h3 className={R.panelTitleClass}>
            <Filter size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
            Typ miejsca
          </h3>
          <div className={R.filterListClass}>
            {filters.map((f) => {
              const active = activeFilterKey === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onFilterChange(f.key)}
                  className={`${R.filterButtonBase} ${active ? R.filterButtonActive : R.filterButtonInactive}`}
                  aria-pressed={active}
                >
                  <span className="min-w-0 truncate">{f.label}</span>
                  <span className={active ? R.filterCountActiveClass : R.filterCountClass}>
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </motion.aside>
  )
}
