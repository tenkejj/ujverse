import { BadgeCheck } from 'lucide-react'
import { formatEventDateParts, type UJEvent } from '../data/mockEvents'
import { sideMutedCls, sidePanelHoverFocus, widgetGoldCls } from '../lib/sidePanelStyles'
import BaseCard from './ui/BaseCard'

type Props = {
  event: UJEvent
  onSelect: (e: UJEvent) => void
}

export default function CompactEventRow({ event: ev, onSelect }: Props) {
  const { monthLabel, dayNum } = formatEventDateParts(ev.date)
  const official = Boolean(ev.is_official)
  return (
    <BaseCard
      as="button"
      type="button"
      variant="inner"
      interactive
      onClick={() => onSelect(ev)}
      className={`group m-0 p-3 w-full flex cursor-pointer items-start gap-3 text-left transition-colors ${sidePanelHoverFocus} ${
        official
          ? 'ring-1 ring-[#a48955]/25 bg-[#a48955]/[0.08] dark:ring-brand-gold/25 dark:bg-brand-gold/[0.06]'
          : ''
      }`}
    >
      <div className="shrink-0 text-center w-12">
        <span
          className={`block text-[10px] font-bold ${widgetGoldCls} leading-none uppercase tracking-wide transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
        >
          {monthLabel}
        </span>
        <span className="block text-[15px] font-extrabold text-[#1e293b] dark:text-white leading-tight">
          {dayNum}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-sm font-medium text-[#1e293b] dark:text-white leading-snug truncate min-w-0">
            {ev.title}
          </p>
          {official ? (
            <BadgeCheck
              size={14}
              className={`${widgetGoldCls} shrink-0 mt-0.5 transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
              strokeWidth={2.5}
              aria-label="Oficjalne UJ"
            />
          ) : null}
        </div>
        <span className={`text-xs ${sideMutedCls}`}>{ev.category}</span>
      </div>
    </BaseCard>
  )
}
