import { useLocation, useNavigate } from 'react-router-dom'
import { Layers, TrendingUp } from 'lucide-react'
import { GROUP_DEFAULT_PATH, groupPathForSlug } from '../lib/groupPaths'
import {
  STREFY_SECTION_LABEL,
  getChannelDescription,
} from '../lib/channelPresentation'
import { formatTrendingPostCount } from '../lib/formatPostCount'
import { useGroups } from '../hooks/useGroups'
import { useTrendingGroups } from '../hooks/useTrendingGroups'
import type { GroupRow, TrendingGroupRow } from '../services/GroupService'
import BaseCard from './ui/BaseCard'
import {
  ZONES_LIST_PANEL_CLS,
  ZONES_LIST_RAIL_CLS,
  ZONE_HASHTAG_CLS,
  ZONE_NAME_CLS,
  ZONE_ROW_CLS,
} from '../lib/zoneListUi'
import {
  sectionTitleCls,
  sideHeaderLinkCls,
  sidePanelHoverFocus,
  widgetGoldCls,
} from '../lib/sidePanelStyles'

const SEE_ALL_BTN_CLS = `shrink-0 rounded-lg px-1.5 py-1 text-xs font-medium ${sideHeaderLinkCls} ${sidePanelHoverFocus}`
const SECTION_HEADER_CLS = 'mb-3 flex min-w-0 items-center gap-2'

type GroupNavVariant = 'panel' | 'rail'
type GroupNavMode = 'trending' | 'all'

export type GroupNavProps = {
  className?: string
  variant?: GroupNavVariant
  mode?: GroupNavMode
}

type GroupRowLike = GroupRow | TrendingGroupRow

function ZoneRow({
  group,
  isTop,
  mode,
  onSelect,
}: {
  group: GroupRowLike
  isTop: boolean
  mode: GroupNavMode
  onSelect: () => void
}) {
  const isTrendingMode = mode === 'trending'
  const postCount = 'postCount' in group ? group.postCount : null

  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      flush
      title={getChannelDescription(group.slug, group.name)}
      onClick={onSelect}
      className={ZONE_ROW_CLS}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={ZONE_NAME_CLS}>{group.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {isTrendingMode && isTop && (
            <TrendingUp
              size={13}
              className="text-zinc-500 dark:text-zinc-400"
              strokeWidth={2.25}
              aria-label="Najpopularniejszy temat"
            />
          )}
          <span className={ZONE_HASHTAG_CLS}>#{group.slug.toUpperCase()}</span>
        </span>
      </div>
      {isTrendingMode && postCount !== null && (
        <p className="mt-1 text-xs leading-snug text-zinc-500 dark:text-zinc-400 text-left">
          {formatTrendingPostCount(postCount)}
        </p>
      )}
    </BaseCard>
  )
}

function ZonesListBody({
  loading,
  error,
  groups,
  mode,
  onSelect,
  layout,
}: {
  loading: boolean
  error: string | null
  groups: GroupRowLike[]
  mode: GroupNavMode
  onSelect: (slug: string) => void
  layout: GroupNavVariant
}) {
  const containerCls = layout === 'rail' ? ZONES_LIST_RAIL_CLS : ZONES_LIST_PANEL_CLS
  const isTrendingMode = mode === 'trending'

  if (loading) {
    return (
      <div className={containerCls}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-14 animate-pulse rounded-2xl border border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-black/40 ${
              layout === 'rail' ? 'min-w-44 shrink-0' : 'w-full'
            }`}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {isTrendingMode ? 'Brak aktywności w ostatnich 7 dniach.' : 'Brak zdefiniowanych stref.'}
      </p>
    )
  }

  return (
    <div className={containerCls}>
      {groups.map((group, index) => (
        <div
          key={group.id}
          className={layout === 'rail' ? 'min-w-44 shrink-0' : undefined}
        >
          <ZoneRow
            group={group}
            isTop={index === 0}
            mode={mode}
            onSelect={() => onSelect(group.slug)}
          />
        </div>
      ))}
    </div>
  )
}

export default function GroupNav({
  className = '',
  variant = 'panel',
  mode = 'trending',
}: GroupNavProps) {
  const navigate = useNavigate()
  useLocation()
  const isTrendingMode = mode === 'trending'
  const { groups: trendingGroups, loading: trendingLoading, error: trendingError } = useTrendingGroups(
    5,
    isTrendingMode,
  )
  const { groups: allGroups, loading: allLoading, error: allError } = useGroups(!isTrendingMode)
  const isRail = variant === 'rail'
  const groups = isTrendingMode ? trendingGroups : allGroups
  const loading = isTrendingMode ? trendingLoading : allLoading
  const error = isTrendingMode ? trendingError : allError

  const pickZone = (slug: string) => {
    navigate(groupPathForSlug(slug))
  }

  const openAllZonesView = () => {
    const firstSlug = groups[0]?.slug
    if (firstSlug) {
      navigate(groupPathForSlug(firstSlug))
      return
    }
    navigate(GROUP_DEFAULT_PATH)
  }

  const seeAllButton = (
    <button
      type="button"
      onClick={openAllZonesView}
      className={SEE_ALL_BTN_CLS}
      aria-label="Przejdź do wszystkich stref"
    >
      Zobacz wszystkie strefy →
    </button>
  )

  if (isRail) {
    return (
      <section className={className} aria-label="Strefy">
        <div className={SECTION_HEADER_CLS}>
          <Layers size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
          <span className={`${sectionTitleCls} min-w-0 flex-1`}>{STREFY_SECTION_LABEL}</span>
          {isTrendingMode ? seeAllButton : null}
        </div>
        <nav aria-label="Strefy">
          <ZonesListBody
            loading={loading}
            error={error}
            groups={groups}
            mode={mode}
            onSelect={pickZone}
            layout="rail"
          />
        </nav>
      </section>
    )
  }

  return (
    <BaseCard variant="default" className={`p-4 flex flex-col gap-4 shrink-0 ${className}`}>
      <div className={SECTION_HEADER_CLS}>
        <Layers size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
        <span className={`${sectionTitleCls} min-w-0 flex-1`}>{STREFY_SECTION_LABEL}</span>
        {isTrendingMode ? seeAllButton : null}
      </div>
      <nav aria-label="Strefy">
        <ZonesListBody
          loading={loading}
          error={error}
          groups={groups}
          mode={mode}
          onSelect={pickZone}
          layout="panel"
        />
      </nav>
    </BaseCard>
  )
}
