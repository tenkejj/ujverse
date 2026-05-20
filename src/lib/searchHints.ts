import {
  Building2,
  Coins,
  Database,
  GraduationCap,
  IdCard,
  type LucideIcon,
} from 'lucide-react'

/**
 * ACADEMIC_HINTS — gotowy zestaw pigułek akademickich dla fallbacku
 * "Może szukasz?" (System 3 OmniSearchHub v2).
 *
 * Kolejność jest celowa — od najczęściej wyszukiwanego do najbardziej
 * specyficznego.
 */
export type AcademicHint = {
  id: string
  /** Etykieta pigułki (pokazana w UI). */
  label: string
  /** Zapytanie, które trafi do inputu po kliknięciu pigułki. */
  query: string
  icon: LucideIcon
}

export const ACADEMIC_HINTS: ReadonlyArray<AcademicHint> = [
  { id: 'sesja', label: 'Sesja', query: 'sesja', icon: GraduationCap },
  { id: 'stypendia', label: 'Stypendia', query: 'stypendia', icon: Coins },
  { id: 'dziekanat', label: 'Dziekanat', query: 'dziekanat', icon: Building2 },
  { id: 'usos', label: 'USOS', query: 'USOS', icon: Database },
  { id: 'legitymacje', label: 'Legitymacje', query: 'legitymacja', icon: IdCard },
] as const
