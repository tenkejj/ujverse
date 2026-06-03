import DepartmentFilter from './DepartmentFilter'

/**
 * FeedFilters — wrapper agregujący filtry feedu (na razie tylko wydział).
 *
 * Przy `sticky=true` przyklejają się do dolnej krawędzi mobile-headera
 * (`top-14` = wysokość `HEADER_MOBILE.containerClass` na <md). Na `md+`
 * sticky/blur/padding są resetowane — desktopowy feed osadza filtry w karcie
 * z compose, więc dziedziczy jej tło i layout.
 *
 * Mobile sticky bar (zgodnie z taskiem):
 *  - `sticky top-14` — przyklejony do dolnej krawędzi headera (h-14).
 *  - `bg-black/90 backdrop-blur-md` — wymagane w spec'u; dla trybu light
 *    nakładamy fallback `bg-bg-app/95`, żeby czarny pasek nie zalewał
 *    białego feedu.
 *  - `border-b` — wyraźne odcięcie od scrollowanego contentu poniżej.
 *  - `-mx-4 px-4 py-1.5` — pełna szerokość viewportu + minimalny oddech.
 */

type Props = {
  selectedDepartment: string
  onDepartmentChange: (dept: string) => void
  /** Mobile-only sticky pod nagłówkiem. Desktop renderuje inline. */
  sticky?: boolean
  className?: string
}

const STICKY_MOBILE_CLS =
  'sticky top-14 z-40 -mx-4 px-4 py-1.5 ' +
  'bg-bg-app/95 dark:bg-black/90 backdrop-blur-md backdrop-saturate-150 ' +
  'border-b border-zinc-200/60 dark:border-white/5 ' +
  'md:static md:top-auto md:z-auto md:mx-0 md:px-0 md:py-0 ' +
  'md:bg-transparent md:backdrop-blur-none md:border-0 dark:md:bg-transparent'

export default function FeedFilters({
  selectedDepartment,
  onDepartmentChange,
  sticky = false,
  className = '',
}: Props) {
  const wrapperCls = `${sticky ? STICKY_MOBILE_CLS : ''} ${className}`.trim()

  return (
    <div className={wrapperCls}>
      <DepartmentFilter selected={selectedDepartment} onChange={onDepartmentChange} />
    </div>
  )
}
