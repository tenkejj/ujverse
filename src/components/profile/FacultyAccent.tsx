import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { getDeptAccent } from '../../lib/departments'

type Props = {
  /** Nazwa wydziału użytkownika; null/undefined → fallback brand-gold-bright. */
  department: string | null | undefined
  className?: string
  children: ReactNode
}

/**
 * FacultyAccent wstrzykuje trzy CSS vars dla całego poddrzewa:
 *   - `--profile-accent`       (hex)          → indicator, focus ring, FAB
 *   - `--profile-accent-soft`  (rgba)         → glow pod avatarem / FAB
 *   - `--profile-glow`         (box-shadow)   → "premium" shadow hero
 *
 * Zmiana wydziału propaguje bez re-rendera drzewa — tylko podmiana inline vars.
 */
export default function FacultyAccent({ department, className, children }: Props) {
  const style = useMemo<CSSProperties>(() => {
    const accent = getDeptAccent(department)
    return {
      ['--profile-accent' as string]: accent.hex,
      ['--profile-accent-soft' as string]: accent.glowRgba,
      ['--profile-glow' as string]: `0 30px 100px -30px ${accent.glowRgba}`,
    }
  }, [department])

  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}
