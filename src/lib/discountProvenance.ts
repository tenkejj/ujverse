/**
 * Provenance zniżki Couponek UJ — skąd pochodzi wpis.
 *
 *   samorząd   — created_by null + source_url z samorzad.uj.edu.pl (scraper)
 *   student    — dodane przez użytkownika (created_by set)
 *   unofficial — seed / stare wpisy bez oficjalnego źródła
 */

import type { StudentDiscount } from '../types/discounts'

export type DiscountProvenance = 'samorzad' | 'student' | 'unofficial'

export const SAMORZAD_SOURCE_HOST = 'samorzad.uj.edu.pl'

export function isSamorzadSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === SAMORZAD_SOURCE_HOST || host.endsWith(`.${SAMORZAD_SOURCE_HOST}`)
  } catch {
    return /samorzad\.uj\.edu\.pl/i.test(url)
  }
}

export function getDiscountProvenance(
  d: Pick<StudentDiscount, 'created_by' | 'source_url'>,
): DiscountProvenance {
  if (d.created_by) return 'student'
  if (isSamorzadSourceUrl(d.source_url)) return 'samorzad'
  return 'unofficial'
}

export const DISCOUNT_PROVENANCE_META: Record<
  DiscountProvenance,
  { label: string; title: string; className: string }
> = {
  samorzad: {
    label: 'Samorząd',
    title: 'Oficjalna lista Samorządu Studentów UJ',
    className:
      'text-emerald-800 bg-emerald-100/90 dark:text-emerald-200 dark:bg-emerald-500/15',
  },
  student: {
    label: 'Od studentów',
    title: 'Dodane przez społeczność UJverse',
    className:
      'text-sky-800 bg-sky-100/90 dark:text-sky-200 dark:bg-sky-500/15',
  },
  unofficial: {
    label: 'Nieoficjalne',
    title: 'Wpis z katalogu bez potwierdzenia Samorządu — sprawdź na miejscu',
    className:
      'text-amber-900 bg-amber-100/90 dark:text-amber-200 dark:bg-amber-500/15',
  },
}
