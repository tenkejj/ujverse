import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { GROUP_INDEX_PATH, groupPathForSlug } from '../lib/groupPaths'
import { STREFY_SECTION_LABEL, getChannelDescription } from '../lib/channelPresentation'
import {
  OFFICIAL_TAG_META,
  ZoneIcon,
  getZones,
  type OfficialTagSlug,
} from '../services/TagService'
import BaseCard from './ui/BaseCard'
import {
  sectionTitleCls,
  sideHeaderLinkCls,
  sidePanelHoverFocus,
  widgetGoldCls,
} from '../lib/sidePanelStyles'

/**
 * GroupNav — nawigacja po strefach.
 *
 * Warianty:
 *  - `panel` — desktopowa karta sekcji w sidebarze (feed + group pages).
 *  - `rail`  — poziomy scroll używany w `GroupView` na mobile (nawigacja
 *    między strefami wewnątrz grupy). FeedView NIE korzysta z rail
 *    — tam mobile używa skonsolidowanego `<MobileDashboard>`.
 */

const SEE_ALL_BTN_CLS = `shrink-0 rounded-lg px-1.5 py-1 text-xs font-medium ${sideHeaderLinkCls} ${sidePanelHoverFocus}`
const PANEL_HEADER_CLS = 'mb-2 flex min-w-0 items-center gap-2'
const RAIL_HEADER_CLS = 'hidden md:flex relative mb-2 min-w-0 items-center justify-center gap-2'
const ROW_CLS = `group m-0 w-full flex cursor-pointer items-center gap-2 p-2.5 shadow-none ${sidePanelHoverFocus}`
const ROW_ICON_COL_CLS = 'shrink-0 flex w-12 items-center justify-center min-h-[36px]'
const ROW_NAME_CLS =
  'min-w-0 flex-1 truncate text-left text-sm font-bold text-[#1e293b] dark:text-white leading-snug'
const ROW_HASH_CLS = `shrink-0 text-xs ${widgetGoldCls}`
const CARD_CLS = 'p-4 flex flex-col gap-4 shrink-0'

const RAIL_TRACK_CLS =
  'flex gap-8 justify-between overflow-x-auto scrollbar-hide overscroll-x-contain ' +
  '-mx-0.5 px-0.5 pb-1 [-webkit-overflow-scrolling:touch]'
const RAIL_TAB_CLS =
  'shrink-0 flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center ' +
  'text-zinc-600 transition-colors hover:text-[#1e293b] active:text-[#1e293b] ' +
  'dark:text-zinc-300 dark:hover:text-brand-gold-bright dark:active:text-brand-gold-bright ' +
  '[-webkit-tap-highlight-color:transparent] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[#1e293b]/30 dark:focus-visible:ring-brand-gold/35'
const RAIL_TAB_LABEL_CLS =
  'w-full truncate text-[10px] font-medium leading-none tracking-wide'

type GroupNavVariant = 'panel' | 'rail'
type GroupNavMode = 'trending' | 'all'

export type GroupNavProps = {
  className?: string
  variant?: GroupNavVariant
  mode?: GroupNavMode
  /** Ile stref pokazać (kolejność z `OFFICIAL_TAGS`). Default: 3 (feed). */
  limit?: number
}

function ZoneRow({
  slug,
  onSelect,
}: {
  slug: OfficialTagSlug
  onSelect: () => void
}) {
  const meta = OFFICIAL_TAG_META[slug]
  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      flush
      title={getChannelDescription(slug, meta.name)}
      onClick={onSelect}
      className={ROW_CLS}
    >
      <div className={ROW_ICON_COL_CLS}>
        <ZoneIcon slug={slug} className={`size-5 shrink-0 ${widgetGoldCls}`} />
      </div>
      <span className={ROW_NAME_CLS}>{meta.name}</span>
      <span className={ROW_HASH_CLS}>#{slug}</span>
    </BaseCard>
  )
}

export default function GroupNav({
  className = '',
  variant = 'panel',
  mode = 'trending',
  limit = 3,
}: GroupNavProps) {
  const navigate = useNavigate()
  const isTrendingMode = mode === 'trending'
  const isRail = variant === 'rail'
  const zones = getZones(limit)

  const pickZone = (slug: OfficialTagSlug) => {
    navigate(groupPathForSlug(slug))
  }

  const openAllZonesView = () => {
    navigate(GROUP_INDEX_PATH)
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
        <div className={RAIL_HEADER_CLS}>
          <Layers size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
          <span className={sectionTitleCls}>{STREFY_SECTION_LABEL}</span>
          {isTrendingMode ? (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">{seeAllButton}</div>
          ) : null}
        </div>
        <nav aria-label="Strefy" className={RAIL_TRACK_CLS}>
          {zones.map((slug) => {
            const meta = OFFICIAL_TAG_META[slug]
            return (
              <button
                key={slug}
                type="button"
                onClick={() => pickZone(slug)}
                title={getChannelDescription(slug, meta.name)}
                aria-label={meta.name}
                className={RAIL_TAB_CLS}
              >
                <ZoneIcon
                  slug={slug}
                  className={`size-[22px] shrink-0 ${widgetGoldCls}`}
                />
                <span className={RAIL_TAB_LABEL_CLS}>{meta.name}</span>
              </button>
            )
          })}
        </nav>
      </section>
    )
  }

  return (
    <BaseCard variant="default" className={`${CARD_CLS} ${className}`.trim()}>
      <div className={PANEL_HEADER_CLS}>
        <Layers size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
        <span className={`${sectionTitleCls} min-w-0 flex-1`}>{STREFY_SECTION_LABEL}</span>
        {isTrendingMode ? seeAllButton : null}
      </div>
      <nav aria-label="Strefy" className="space-y-3">
        {zones.map((slug) => (
          <ZoneRow key={slug} slug={slug} onSelect={() => pickZone(slug)} />
        ))}
      </nav>
    </BaseCard>
  )
}
