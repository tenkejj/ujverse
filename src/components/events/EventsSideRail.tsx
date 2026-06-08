import { motion } from 'framer-motion'
import { Activity, Archive, BarChart3, Filter, Radio } from 'lucide-react'
import { EVENTS_HUB } from '../../styles/mobile-theme'
import type { EventStats } from '../../lib/eventGrouping'

/**
 * EventsSideRail — boczna kolumna w `EventsView` (lg:col-span-3).
 *
 * Trzy panele:
 *  1. **Status źródła** — live / archiwum (z `ingestFromStaticFallback`).
 *  2. **Statystyki** — 3 liczby (dziś, ten tydzień, oficjalnych).
 *  3. **Filtruj** — pionowa lista kategorii z licznikami, klika ten sam
 *     state co poziome `FILTER_PILL` w toolbarze (dwa wejścia, jedno źródło).
 *
 * Sticky pod headerem (top-[140px] = header 64px + toolbar 60px + margin).
 *
 * Komponent jest *czysto prezentacyjny* — state filtra i `setFilter` należą
 * do `EventsView`, tu tylko callback `onFilterChange(key)`.
 */
export type SideRailFilter = {
  key: string
  label: string
  count: number
}

type Props = {
  isLive: boolean
  stats: EventStats
  filters: SideRailFilter[]
  activeFilterKey: string
  onFilterChange: (key: string) => void
}

const R = EVENTS_HUB.rail

export default function EventsSideRail({
  isLive,
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
      aria-label="Panel boczny wydarzeń"
    >
      <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
        <h3 className={R.panelTitleClass}>
          <Activity size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
          Status źródła
        </h3>
        <div className={R.liveRowClass} role="status">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Radio size={14} strokeWidth={2} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>Dane na żywo z portalu UJ</span>
            </>
          ) : (
            <>
              <Archive size={14} strokeWidth={2} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
              <span>Archiwum (brak połączenia)</span>
            </>
          )}
        </div>
      </motion.div>

      <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
        <h3 className={R.panelTitleClass}>
          <BarChart3 size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
          Statystyki
        </h3>
        <div className={R.statsGridClass}>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>{stats.today}</span>
            <span className={R.statLabelClass}>Dziś</span>
          </div>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>{stats.thisWeek}</span>
            <span className={R.statLabelClass}>Tydzień</span>
          </div>
          <div className={R.statCellClass}>
            <span className={R.statValueClass}>{stats.official}</span>
            <span className={R.statLabelClass}>Oficjalne</span>
          </div>
        </div>
      </motion.div>

      {filters.length > 0 ? (
        <motion.div variants={EVENTS_HUB.motion.fadeUp} className={R.panelClass}>
          <h3 className={R.panelTitleClass}>
            <Filter size={12} strokeWidth={2.25} className={R.panelTitleIconClass} aria-hidden />
            Filtruj
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
      ) : null}
    </motion.aside>
  )
}
