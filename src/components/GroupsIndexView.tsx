import { useNavigate } from 'react-router-dom'
import { groupPathForSlug } from '../lib/groupPaths'
import { getChannelDescription } from '../lib/channelPresentation'
import { useGroups } from '../hooks/useGroups'
import type { GroupRow } from '../services/GroupService'
import GroupNav from './GroupNav'
import StrefySectionHeader from './StrefySectionHeader'
import BaseCard from './ui/BaseCard'
import {
  ZONES_LIST_PANEL_CLS,
  ZONE_HASHTAG_CLS,
  ZONE_NAME_CLS,
  ZONE_ROW_CLS,
} from '../lib/zoneListUi'

const unifiedCardGapCls = 'gap-4'

function ZoneRow({
  group,
  onSelect,
}: {
  group: GroupRow
  onSelect: () => void
}) {
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
        <span className={ZONE_HASHTAG_CLS}>#{group.slug.toUpperCase()}</span>
      </div>
    </BaseCard>
  )
}

/** Pełna lista stref — `/group` (jak `/events` dla wydarzeń). */
export default function GroupsIndexView() {
  const navigate = useNavigate()
  const { groups, loading, error } = useGroups()

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-4">
      <div className="lg:col-span-6 lg:col-start-4 flex min-w-0 w-full max-w-full flex-col gap-4">
        <div className="lg:hidden">
          <GroupNav variant="rail" />
        </div>

        <BaseCard variant="default" className="p-4 flex flex-col gap-4">
          <StrefySectionHeader />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed -mt-1">
            Przeglądaj wszystkie strefy tematyczne społeczności UJ.
          </p>

          {loading && (
            <div className={ZONES_LIST_PANEL_CLS}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50/50 dark:border-white/10 dark:bg-black/40"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!loading && !error && groups.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Brak zdefiniowanych stref.</p>
          )}

          {!loading && groups.length > 0 && (
            <nav className={ZONES_LIST_PANEL_CLS} aria-label="Wszystkie strefy">
              {groups.map((group) => (
                <ZoneRow
                  key={group.id}
                  group={group}
                  onSelect={() => navigate(groupPathForSlug(group.slug))}
                />
              ))}
            </nav>
          )}
        </BaseCard>
      </div>

      <aside
        className={`hidden lg:flex lg:col-span-3 flex-col ${unifiedCardGapCls} sticky top-20 self-start`}
      >
        <GroupNav variant="panel" className="shrink-0" />
      </aside>
    </div>
  )
}
