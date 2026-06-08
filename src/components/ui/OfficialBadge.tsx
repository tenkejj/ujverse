import { Shield } from 'lucide-react'

/**
 * OfficialBadge — jeden komponent dla wszystkich „OFICJALNE UJ" w apce.
 *
 * Wcześniej każdy widok rysował własny wariant (`EventCard`, `EventModal`,
 * `WziksOfficialHub`) z lokalnymi hardkodami `#c9a227`, `#f5e6a8`, `#f0d060`.
 * Tu mamy jedno źródło prawdy spójne z `theme.text.goldMuted` + `theme.colors.gold`.
 *
 * Warianty:
 *  - `inline` (domyślny) — badge wewnątrz karty na bg-glass.
 *  - `floating` — badge nakładany na plakat/zdjęcie (ciemne tło + backdrop-blur),
 *    używany w `EventModal` i `WziksOfficialHub`.
 *
 * Rozmiary:
 *  - `xs` — 9px label (CompactEventRow, gęste rzędy).
 *  - `sm` — 10px label (EventCard, karuzela OFICJALNE UJ).
 *  - `md` — 11px label (EventModal hero).
 */

type Props = {
  size?: 'xs' | 'sm' | 'md'
  variant?: 'inline' | 'floating'
  className?: string
}

const sizeClasses: Record<NonNullable<Props['size']>, string> = {
  xs: 'gap-1 px-1.5 py-0.5 text-[9px]',
  sm: 'gap-1 px-2 py-0.5 text-[10px]',
  md: 'gap-1.5 px-2.5 py-1 text-[11px]',
}

const iconSize: Record<NonNullable<Props['size']>, number> = {
  xs: 10,
  sm: 11,
  md: 13,
}

const variantClasses: Record<NonNullable<Props['variant']>, string> = {
  inline:
    'border-[#1e293b]/40 bg-[#1e293b]/[0.06] text-[#1e293b] ' +
    'dark:border-brand-gold/45 dark:bg-brand-gold/10 dark:text-brand-gold-bright',
  floating:
    'border-[#1e293b]/35 bg-white/80 text-[#1e293b] backdrop-blur-sm ' +
    'dark:border-brand-gold/45 dark:bg-black/55 dark:text-brand-gold-bright',
}

export default function OfficialBadge({
  size = 'sm',
  variant = 'inline',
  className = '',
}: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-extrabold uppercase tracking-wider ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      title="Wydarzenie oficjalne UJ"
    >
      <Shield size={iconSize[size]} strokeWidth={2.5} aria-hidden />
      OFICJALNE UJ
    </span>
  )
}
