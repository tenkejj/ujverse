import { GraduationCap, type LucideIcon } from 'lucide-react'

/**
 * InstitutionAvatar — awatar dla „instytucjonalnych" autorów (Uniwersytet
 * Jagielloński, WZiKS UJ, ...) zamiast generycznej litery „U" z `UserAvatar`.
 *
 * Render: okrągłe tło + ikona (lucide) wycentrowana. Kolory z systemowej palety:
 *   - light: navy `#1e293b` (z deklaratywnym tłem `#1e293b/8`)
 *   - dark:  `brand-gold-bright`
 *
 * API zgodne z `UserAvatar` (`className` na rozmiar) — drop-in dla
 * `EventCard` / `WziksOfficialHub` / przyszłych miejsc z autorem oficjalnym.
 */

type Props = {
  /** Wymiary jak w `UserAvatar`, np. `'h-6 w-6'`. */
  className?: string
  /** Etykieta dostępna (czytnik ekranu). */
  label?: string
  /** Wymiar ikony lucide w px. Domyślnie skalowane do ~60% boxa. */
  iconSize?: number
  /** Override ikony (np. `Building2` dla WZiKS). */
  icon?: LucideIcon
}

export default function InstitutionAvatar({
  className = 'h-10 w-10',
  label = 'Uniwersytet Jagielloński',
  iconSize,
  icon: Icon = GraduationCap,
}: Props) {
  const computedIconSize =
    iconSize ??
    // Heurystyka: rozmiar avatara `h-{n}` w Tailwind = `n*4px`.
    // `h-6` (24 px) → ikona 14 px, `h-10` (40 px) → ikona 22 px.
    inferIconSize(className)

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`flex items-center justify-center shrink-0 rounded-full ring-1 bg-[#1e293b]/[0.08] ring-[#1e293b]/20 text-[#1e293b] dark:bg-brand-gold-bright/[0.12] dark:ring-brand-gold-bright/30 dark:text-brand-gold-bright ${className}`}
    >
      <Icon size={computedIconSize} strokeWidth={2.25} aria-hidden />
    </div>
  )
}

function inferIconSize(className: string): number {
  const m = className.match(/\bh-(\d+)\b/)
  if (!m) return 18
  const tw = parseInt(m[1], 10)
  if (Number.isNaN(tw)) return 18
  // 60% boxa, zaokrąglone do 2 px.
  return Math.max(10, Math.round((tw * 4 * 0.6) / 2) * 2)
}
