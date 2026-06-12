/**
 * UJverse — typy dla modułu "Couponek UJ" (zniżki studenckie w Krakowie).
 *
 * Świadomie odseparowane od `types/database.ts` (które jest auto-generowane
 * przez `supabase gen types`). Tutaj trzymamy lokalne typy aplikacji żeby:
 *   - moduł `znizki` był samodzielny (zmiana DB → tylko ten plik),
 *   - można było dodać computed fields (np. `distance_meters`).
 *
 * Lista kategorii MUSI być w sync z CHECK constraintem w migracji
 * `20260625100000_student_discounts.sql` (sekcja `category text not null check`).
 */

export type DiscountCategory =
  | 'jedzenie'
  | 'kawa'
  | 'kultura'
  | 'kino'
  | 'sport'
  | 'ksiazki'
  | 'uslugi'
  | 'transport'
  | 'odziez'
  | 'inne'

export const DISCOUNT_CATEGORIES: ReadonlyArray<DiscountCategory> = [
  'jedzenie',
  'kawa',
  'kultura',
  'kino',
  'sport',
  'ksiazki',
  'uslugi',
  'transport',
  'odziez',
  'inne',
] as const

export type DiscountCategoryMeta = {
  slug: DiscountCategory
  label: string
  /** Lucide icon name w PascalCase — komponent dobiera w UI przez switch. */
  icon: 'Pizza' | 'Coffee' | 'Music2' | 'Clapperboard' | 'Dumbbell' | 'BookOpen' | 'Scissors' | 'Bus' | 'Shirt' | 'Tag'
  /** Tailwind tint dla pilla / ikony (light/dark spójny). */
  tint: string
}

export const DISCOUNT_CATEGORY_META: Record<DiscountCategory, DiscountCategoryMeta> = {
  jedzenie:   { slug: 'jedzenie',   label: 'Jedzenie',     icon: 'Pizza',       tint: 'text-orange-700 bg-orange-100 dark:text-orange-200 dark:bg-orange-500/15' },
  kawa:       { slug: 'kawa',       label: 'Kawa',         icon: 'Coffee',      tint: 'text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
  kultura:    { slug: 'kultura',    label: 'Kultura',      icon: 'Music2',      tint: 'text-purple-700 bg-purple-100 dark:text-purple-200 dark:bg-purple-500/15' },
  kino:       { slug: 'kino',       label: 'Kino',         icon: 'Clapperboard', tint: 'text-rose-700 bg-rose-100 dark:text-rose-200 dark:bg-rose-500/15' },
  sport:      { slug: 'sport',      label: 'Sport',        icon: 'Dumbbell',    tint: 'text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-500/15' },
  ksiazki:    { slug: 'ksiazki',    label: 'Książki',      icon: 'BookOpen',    tint: 'text-indigo-700 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-500/15' },
  uslugi:     { slug: 'uslugi',     label: 'Usługi',       icon: 'Scissors',    tint: 'text-pink-700 bg-pink-100 dark:text-pink-200 dark:bg-pink-500/15' },
  transport:  { slug: 'transport',  label: 'Transport',    icon: 'Bus',         tint: 'text-sky-700 bg-sky-100 dark:text-sky-200 dark:bg-sky-500/15' },
  odziez:     { slug: 'odziez',     label: 'Odzież',       icon: 'Shirt',       tint: 'text-fuchsia-700 bg-fuchsia-100 dark:text-fuchsia-200 dark:bg-fuchsia-500/15' },
  inne:       { slug: 'inne',       label: 'Inne',         icon: 'Tag',         tint: 'text-zinc-700 bg-zinc-100 dark:text-zinc-200 dark:bg-zinc-500/15' },
}

export type StudentDiscount = {
  id: string
  created_by: string | null
  business_name: string
  discount_headline: string
  description: string | null
  category: DiscountCategory
  address: string | null
  city: string
  lat: number | null
  lng: number | null
  website_url: string | null
  source_url: string | null
  verified_at: string | null
  verified_by: string | null
  requires_uj_id: boolean
  valid_until: string | null
  use_count: number
  review_count: number
  avg_rating: number | null
  report_count: number
  hidden_at: string | null
  hidden_reason: string | null
  created_at: string
  updated_at: string
}

export type DiscountReview = {
  id: string
  discount_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
  /** Wzbogacenie po join'ie z profiles — opcjonalne. */
  author?: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

export type DiscountReportReason =
  | 'nie_dziala'
  | 'zmienione_warunki'
  | 'zamkniete'
  | 'spam'
  | 'inne'

export const DISCOUNT_REPORT_REASON_LABELS: Record<DiscountReportReason, string> = {
  nie_dziala: 'Zniżka nie działa',
  zmienione_warunki: 'Zmienione warunki',
  zamkniete: 'Lokal zamknięty',
  spam: 'Spam / fake',
  inne: 'Inne',
}

export type DiscountFilter = {
  category: DiscountCategory | 'all'
  search: string
  /** `'use'` = popularność, `'created'` = najnowsze, `'rating'` = najlepiej oceniane. */
  sort: 'use' | 'created' | 'rating'
  /** Tylko zweryfikowane (admin lub źródło oficjalne). */
  verifiedOnly: boolean
}

/** Discount + computed `distance_meters` (gdy mamy geolokację usera). */
export type DiscountWithDistance = StudentDiscount & {
  distanceMeters: number | null
}
