/**
 * UJverse — DiscountCard: karta zniżki na liście "Couponek UJ".
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Compact card pattern dopasowany do reszty wyspowych kart (`MojPlanView`) —
 * BaseCard + theme tokens + brand-gold akcent dla CTA "Wziąłem!".
 *
 * Stany wizualne:
 *   - default
 *   - `taken` (myUsedIds.has(id)) — green check + dim CTA
 *   - `verified` (verified_at != null) — checkmark badge
 *   - `nearby` (distanceMeters !== null && < 500) — pill "≈ 320m"
 */
import { memo } from 'react'
import {
  BadgeCheck,
  BookOpen,
  Bus,
  Check,
  Clapperboard,
  Coffee,
  Dumbbell,
  MapPin,
  Music2,
  Pizza,
  Scissors,
  Shirt,
  Star,
  Tag,
  Users,
} from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { theme } from '../../styles/theme'
import { DISCOUNT_CATEGORY_META } from '../../types/discounts'
import type { DiscountWithDistance } from '../../types/discounts'

type Props = {
  discount: DiscountWithDistance
  taken: boolean
  onOpenDetail: (id: string) => void
  onMarkUse: (id: string) => void
}

const ICON_MAP = {
  Pizza,
  Coffee,
  Music2,
  Clapperboard,
  Dumbbell,
  BookOpen,
  Scissors,
  Bus,
  Shirt,
  Tag,
} as const

function fmtDistance(meters: number | null): string | null {
  if (meters == null) return null
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function DiscountCardImpl({ discount, taken, onOpenDetail, onMarkUse }: Props) {
  const meta = DISCOUNT_CATEGORY_META[discount.category]
  const Icon = ICON_MAP[meta.icon]
  const distanceLabel = fmtDistance(discount.distanceMeters)
  const isNearby = discount.distanceMeters !== null && discount.distanceMeters < 500
  const isVerified = Boolean(discount.verified_at)

  return (
    <BaseCard
      variant="default"
      className="group relative flex h-full flex-col gap-2.5 p-4 transition-shadow hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => onOpenDetail(discount.id)}
        className="absolute inset-0 z-0"
        aria-label={`${discount.business_name} — szczegóły`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tint}`}>
          <Icon size={11} strokeWidth={2.3} />
          {meta.label}
        </span>
        {isVerified && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
            title="Zweryfikowane przez admina"
          >
            <BadgeCheck size={13} strokeWidth={2.2} />
            potwierdzone
          </span>
        )}
      </div>

      <h3 className={`relative z-10 line-clamp-2 text-[15px] font-bold leading-tight ${theme.text.primary}`}>
        {discount.business_name}
      </h3>

      <p className={`relative z-10 line-clamp-2 text-[13px] font-semibold leading-snug text-brand-gold dark:text-brand-gold-bright`}>
        {discount.discount_headline}
      </p>

      {(discount.address || isNearby) && (
        <p className={`relative z-10 flex items-center gap-1 truncate text-[11.5px] ${theme.text.muted}`}>
          <MapPin size={11} className="shrink-0" />
          {discount.address ?? '—'}
          {distanceLabel && (
            <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              isNearby
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-300'
            }`}>
              {distanceLabel}
            </span>
          )}
        </p>
      )}

      <div className={`relative z-10 mt-auto flex items-center justify-between gap-2 pt-2 text-[11.5px] ${theme.text.muted}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1" title="Liczba osób, które wzięły">
            <Users size={12} strokeWidth={2.2} />
            <span className="tabular-nums">{discount.use_count}</span>
          </span>
          {discount.avg_rating != null && (
            <span className="inline-flex items-center gap-1" title={`${discount.review_count} ocen`}>
              <Star size={12} className="fill-amber-400 text-amber-500" strokeWidth={0} />
              <span className="tabular-nums">{discount.avg_rating.toFixed(1)}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMarkUse(discount.id)
          }}
          disabled={taken}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
            taken
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 cursor-default'
              : 'bg-brand-gold text-white hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90'
          }`}
        >
          {taken ? (
            <>
              <Check size={12} strokeWidth={2.8} />
              Wzięte
            </>
          ) : (
            'Wziąłem!'
          )}
        </button>
      </div>
    </BaseCard>
  )
}

export default memo(DiscountCardImpl)
