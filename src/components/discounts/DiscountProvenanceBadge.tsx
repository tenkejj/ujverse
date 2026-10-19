import { BadgeCheck, CircleHelp, Users } from 'lucide-react'
import {
  DISCOUNT_PROVENANCE_META,
  getDiscountProvenance,
  type DiscountProvenance,
} from '../../lib/discountProvenance'
import type { StudentDiscount } from '../../types/discounts'

type Props = {
  discount: Pick<StudentDiscount, 'created_by' | 'source_url'>
  /** Domyślnie kompaktowy badge na karcie; `detail` nieco większy. */
  size?: 'card' | 'detail'
}

const ICONS: Record<DiscountProvenance, typeof BadgeCheck> = {
  samorzad: BadgeCheck,
  student: Users,
  unofficial: CircleHelp,
}

export default function DiscountProvenanceBadge({
  discount,
  size = 'card',
}: Props) {
  const kind = getDiscountProvenance(discount)
  const meta = DISCOUNT_PROVENANCE_META[kind]
  const Icon = ICONS[kind]
  const pad = size === 'detail' ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[10px]'
  const iconSize = size === 'detail' ? 12 : 11

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold tracking-wide ${pad} ${meta.className}`}
      title={meta.title}
    >
      <Icon size={iconSize} strokeWidth={2.2} aria-hidden />
      {meta.label}
    </span>
  )
}
