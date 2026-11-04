/**
 * Wspólny szkielet hubów informacyjnych — ten sam język co EventsHub
 * (toolbar + siatka + boczny rail ze EVENTS_HUB).
 */
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Activity, Archive, BarChart3, Filter, Radio, Search } from 'lucide-react'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import { FOCUS_RING } from './infoUi'

const H = EVENTS_HUB

export type HubFilter = { key: string; label: string; count?: number }
export type HubStat = { value: string | number; label: string }

export function InfoHubShell({
  children,
  rail,
}: {
  children: ReactNode
  rail?: ReactNode
}) {
  return (
    <div
      className={
        rail
          ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]'
          : 'min-w-0'
      }
    >
      <motion.div
        variants={H.motion.page}
        initial="hidden"
        animate="show"
        className="min-w-0 space-y-6"
      >
        {children}
      </motion.div>
      {rail ? (
        <motion.aside
          variants={H.motion.page}
          initial="hidden"
          animate="show"
          className={H.rail.wrapClass}
        >
          {rail}
        </motion.aside>
      ) : null}
    </div>
  )
}

export function InfoHubTitle({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[1.75rem] dark:text-zinc-50">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function InfoHubToolbar({
  filters,
  activeKey,
  onFilterChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Szukaj…',
  searchAriaLabel = 'Szukaj',
  trailing,
  live,
}: {
  filters: HubFilter[]
  activeKey: string
  onFilterChange: (key: string) => void
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchAriaLabel?: string
  trailing?: ReactNode
  live?: { on: boolean; label: string }
}) {
  return (
    <div className={H.toolbar.stickyWrapClass}>
      <div className={H.toolbar.rowClass}>
        <div className={H.toolbar.pillsWrapClass} role="group">
          {filters.map((filter) => {
            const active = filter.key === activeKey
            if (filter.key !== activeKey && filter.count === 0) return null
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(filter.key)}
                className={`${FILTER_PILL.base} ${active ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              >
                {filter.label}
                {typeof filter.count === 'number' ? (
                  <span className="tabular-nums opacity-70">{filter.count}</span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div className={H.toolbar.actionsWrapClass}>
          {live ? (
            <span className={EVENTS_TOOLBAR.liveBadge} role="status" aria-label={live.label}>
              {live.on ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <Radio size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  Live
                </>
              ) : (
                <>
                  <Archive size={12} className="shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
                  Offline
                </>
              )}
            </span>
          ) : null}
          {onSearchChange ? (
            <div className={EVENTS_TOOLBAR.searchWrap}>
              <Search strokeWidth={2} className={EVENTS_TOOLBAR.searchLeadingIcon} aria-hidden />
              <input
                type="search"
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel}
                className={EVENTS_TOOLBAR.searchInner}
              />
            </div>
          ) : null}
          {trailing}
        </div>
      </div>
    </div>
  )
}

export function InfoHubSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <section className={H.section.wrapClass}>
      <div className={H.section.headerClass}>
        <h2 className={H.section.titleClass}>{title}</h2>
        {typeof count === 'number' ? <span className={H.section.countBadgeClass}>{count}</span> : null}
      </div>
      {children}
    </section>
  )
}

export function InfoHubCardGrid({ children }: { children: ReactNode }) {
  return <ul className={H.section.gridClass} role="list">{children}</ul>
}

export function InfoHubRailPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Activity
  children: ReactNode
}) {
  return (
    <motion.div variants={H.motion.fadeUp} className={H.rail.panelClass}>
      <h3 className={H.rail.panelTitleClass}>
        <Icon size={12} strokeWidth={2.25} className={H.rail.panelTitleIconClass} aria-hidden />
        {title}
      </h3>
      {children}
    </motion.div>
  )
}

export function InfoHubRailStatus({ live, label }: { live: boolean; label: string }) {
  return (
    <InfoHubRailPanel title="Status źródła" icon={Activity}>
      <div className={H.rail.liveRowClass} role="status">
        {live ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Radio size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span>{label}</span>
          </>
        ) : (
          <>
            <Archive size={14} className="shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
            <span>{label}</span>
          </>
        )}
      </div>
    </InfoHubRailPanel>
  )
}

export function InfoHubRailStats({ stats }: { stats: HubStat[] }) {
  return (
    <InfoHubRailPanel title="Statystyki" icon={BarChart3}>
      <div className={H.rail.statsGridClass}>
        {stats.map((stat) => (
          <div key={stat.label} className={H.rail.statCellClass}>
            <span className={H.rail.statValueClass}>{stat.value}</span>
            <span className={H.rail.statLabelClass}>{stat.label}</span>
          </div>
        ))}
      </div>
    </InfoHubRailPanel>
  )
}

export function InfoHubRailFilters({
  filters,
  activeKey,
  onFilterChange,
}: {
  filters: HubFilter[]
  activeKey: string
  onFilterChange: (key: string) => void
}) {
  return (
    <InfoHubRailPanel title="Filtruj" icon={Filter}>
      <div className={H.rail.filterListClass} role="group">
        {filters.map((filter) => {
          const active = filter.key === activeKey
          if (!active && filter.count === 0) return null
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(filter.key)}
              className={`${H.rail.filterButtonBase} ${
                active ? H.rail.filterButtonActive : H.rail.filterButtonInactive
              } ${FOCUS_RING}`}
            >
              <span className="truncate">{filter.label}</span>
              {typeof filter.count === 'number' ? (
                <span className={active ? H.rail.filterCountActiveClass : H.rail.filterCountClass}>
                  {filter.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </InfoHubRailPanel>
  )
}

/**
 * Spotlight w języku EventsHero, ale bez pustego plakatu —
 * kompaktowa karta z eyebrow + tytułem (komunikaty / rejestracje / Start).
 */
export function InfoHubSpotlight({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow: string
  title: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <motion.section variants={H.motion.fadeUp} className={H.hero.cardClass} aria-label={eyebrow}>
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand-ink via-brand-ink/70 to-brand-ink/30 dark:from-brand-gold-bright dark:via-brand-gold-bright/70 dark:to-brand-gold-bright/20"
          aria-hidden
        />
        <div className="flex flex-col gap-4 p-5 pl-6 sm:p-6 sm:pl-7 md:p-7 md:pl-8">
          <span className="inline-flex w-fit items-center rounded-full border border-zinc-200/90 bg-zinc-100/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-zinc-200">
            {eyebrow}
          </span>
          <h2 className={H.hero.titleClass}>{title}</h2>
          {meta ? <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">{meta}</div> : null}
          {actions ? <div className={H.hero.actionsRowClass}>{actions}</div> : null}
        </div>
      </div>
    </motion.section>
  )
}
