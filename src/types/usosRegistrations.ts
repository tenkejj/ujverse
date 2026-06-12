/**
 * UJverse — typy dla modułu USOS Registrations (alarmy rejestracji).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Lista `kind` MUSI być w sync z CHECK constraintem w migracji
 * `20260627100000_usos_registrations.sql`.
 */

export type RegistrationKind =
  | 'obieralne'
  | 'lektoraty'
  | 'wf'
  | 'seminarium'
  | 'specjalizacja'
  | 'inne'

export const REGISTRATION_KINDS: ReadonlyArray<RegistrationKind> = [
  'obieralne',
  'lektoraty',
  'wf',
  'seminarium',
  'specjalizacja',
  'inne',
] as const

export type RegistrationKindMeta = {
  slug: RegistrationKind
  label: string
  /** Lucide icon name — komponent dobiera w UI przez switch. */
  icon: 'BookOpen' | 'Languages' | 'Dumbbell' | 'GraduationCap' | 'Sparkles' | 'Tag'
  /** Tailwind tint dla pilla / chip badge. */
  tint: string
}

export const REGISTRATION_KIND_META: Record<RegistrationKind, RegistrationKindMeta> = {
  obieralne:     { slug: 'obieralne',     label: 'Obieralne',     icon: 'BookOpen',      tint: 'text-indigo-700 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-500/15' },
  lektoraty:     { slug: 'lektoraty',     label: 'Lektoraty',     icon: 'Languages',     tint: 'text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-500/15' },
  wf:            { slug: 'wf',            label: 'WF',            icon: 'Dumbbell',      tint: 'text-orange-700 bg-orange-100 dark:text-orange-200 dark:bg-orange-500/15' },
  seminarium:    { slug: 'seminarium',    label: 'Seminarium',    icon: 'GraduationCap', tint: 'text-rose-700 bg-rose-100 dark:text-rose-200 dark:bg-rose-500/15' },
  specjalizacja: { slug: 'specjalizacja', label: 'Specjalizacja', icon: 'Sparkles',      tint: 'text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/15' },
  inne:          { slug: 'inne',          label: 'Inne',          icon: 'Tag',           tint: 'text-zinc-700 bg-zinc-100 dark:text-zinc-200 dark:bg-zinc-500/15' },
}

export type UsosRegistration = {
  id: string
  created_by: string | null
  title: string
  description: string | null
  study_program: string | null
  year: number | null
  audience_label: string | null
  opens_at: string
  closes_at: string | null
  registration_url: string
  info_url: string | null
  kind: RegistrationKind
  subscriber_count: number
  /** FK do `announcements.id` jeśli wpis powstał automatycznie z ogłoszenia
   *  wydziałowego (AI extractor — fallback dla rejestracji wspomnianych w komunikatach).
   *  NULL = wpis community / seed / USOSweb live. */
  source_announcement_id?: string | null
  /** `tura_id` z USOSweb katalogu rejestracji (np. "45118"). NOT NULL = wpis
   *  scrapowany live z USOSweb (najbardziej autorytatywne źródło). */
  source_usos_tura_id?: string | null
  /** Kod jednostki UJ z USOSweb (np. "UJ.WF.IFA"). Współwystępuje z `source_usos_tura_id`. */
  source_unit_code?: string | null
  /** Krótka etykieta źródła ("Live · USOSweb · {nazwa jednostki}" / "AI · ogłoszenie wydziału"). */
  source_label?: string | null
  created_at: string
  updated_at: string
}

/** Wynik RPC `get_my_upcoming_registrations` — zwraca subskrypcje + dane rejestracji. */
export type MyUpcomingRegistration = {
  registration_id: string
  title: string
  description: string | null
  study_program: string | null
  year: number | null
  audience_label: string | null
  opens_at: string
  closes_at: string | null
  registration_url: string
  info_url: string | null
  kind: RegistrationKind
  subscriber_count: number
  subscribed_at: string
  dismissed_at: string | null
}

export type RegistrationFilter = {
  kind: RegistrationKind | 'all'
  search: string
  /** `'opens'` = najbliższe pierwsze (default), `'subscribers'` = najpopularniejsze, `'created'` = najnowsze wpisy. */
  sort: 'opens' | 'subscribers' | 'created'
  /** Pokaż tylko dla mojego kierunku/roku (na podstawie profilu). */
  myProgramOnly: boolean
  /** Pokaż tylko już subskrybowane. */
  subscribedOnly: boolean
}

/**
 * Wyliczone fazy odliczania — pomocnicze do UI (kolor pilla, label).
 * Wszystkie threshold-y dobrane pod ux rejestracji USOS:
 *   • critical  — ≤ 1h do startu (czerwony, banner z alarmem)
 *   • urgent    — ≤ 24h
 *   • soon      — ≤ 7 dni
 *   • upcoming  — > 7 dni
 *   • live      — między opens_at i closes_at (rejestracja trwa)
 *   • closed    — closes_at minęło
 */
export type CountdownPhase =
  | 'critical'
  | 'urgent'
  | 'soon'
  | 'upcoming'
  | 'live'
  | 'closed'

export type CountdownInfo = {
  phase: CountdownPhase
  /** Milliseconds do `opens_at` (ujemne gdy już otwarte). */
  msUntilOpen: number
  /** Milliseconds do `closes_at` (null gdy brak `closes_at`). */
  msUntilClose: number | null
  /** Human-readable label "za 3 dni 4h", "trwa: zostało 2h", "zakończona". */
  label: string
  /** Compact label do badge (np. "3d 4h", "2h 30m", "5m"). */
  compact: string
}

export function computeCountdown(opensAt: string, closesAt: string | null, now: Date = new Date()): CountdownInfo {
  const opens = new Date(opensAt).getTime()
  const closes = closesAt ? new Date(closesAt).getTime() : null
  const t = now.getTime()
  const msUntilOpen = opens - t
  const msUntilClose = closes !== null ? closes - t : null

  // Phase resolution
  let phase: CountdownPhase
  if (closes !== null && t >= closes) phase = 'closed'
  else if (t >= opens) phase = 'live'
  else if (msUntilOpen <= 60 * 60 * 1000) phase = 'critical'
  else if (msUntilOpen <= 24 * 60 * 60 * 1000) phase = 'urgent'
  else if (msUntilOpen <= 7 * 24 * 60 * 60 * 1000) phase = 'soon'
  else phase = 'upcoming'

  // Label
  let label: string
  let compact: string
  if (phase === 'closed') {
    label = 'Rejestracja zakończona'
    compact = 'zakończona'
  } else if (phase === 'live') {
    if (msUntilClose !== null) {
      const { compact: c, full } = formatDuration(msUntilClose)
      label = `Trwa: zostało ${full}`
      compact = c
    } else {
      label = 'Trwa rejestracja'
      compact = 'trwa'
    }
  } else {
    const { compact: c, full } = formatDuration(msUntilOpen)
    label = `Otwiera się za ${full}`
    compact = c
  }
  return { phase, msUntilOpen, msUntilClose, label, compact }
}

function formatDuration(ms: number): { compact: string; full: string } {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins = totalMin % 60
  if (days > 0) {
    return {
      compact: `${days}d ${hours}h`,
      full: `${days} ${pluralPL(days, 'dzień', 'dni', 'dni')} ${hours}h`,
    }
  }
  if (hours > 0) {
    return {
      compact: `${hours}h ${mins}m`,
      full: `${hours} ${pluralPL(hours, 'godzinę', 'godziny', 'godzin')} ${mins} min`,
    }
  }
  // <1h — pokazujemy minuty/sekundy
  if (totalMin > 0) {
    return { compact: `${totalMin}m`, full: `${totalMin} min` }
  }
  const secs = Math.max(0, Math.floor(ms / 1000))
  return { compact: `${secs}s`, full: `${secs} sek` }
}

function pluralPL(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (n === 1) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** Tailwind tint klasy per phase — używane przez countdown badge. */
export const COUNTDOWN_PHASE_TINT: Record<CountdownPhase, string> = {
  critical: 'text-red-700 bg-red-100 ring-red-200/60 dark:text-red-200 dark:bg-red-500/20 dark:ring-red-400/30',
  urgent:   'text-orange-700 bg-orange-100 ring-orange-200/60 dark:text-orange-200 dark:bg-orange-500/20 dark:ring-orange-400/30',
  soon:     'text-amber-700 bg-amber-100 ring-amber-200/60 dark:text-amber-200 dark:bg-amber-500/15 dark:ring-amber-400/20',
  upcoming: 'text-zinc-700 bg-zinc-100 ring-zinc-200/60 dark:text-zinc-200 dark:bg-zinc-500/15 dark:ring-zinc-400/20',
  live:     'text-emerald-700 bg-emerald-100 ring-emerald-200/60 dark:text-emerald-200 dark:bg-emerald-500/20 dark:ring-emerald-400/30',
  closed:   'text-zinc-500 bg-zinc-50 ring-zinc-200/60 dark:text-zinc-400 dark:bg-zinc-800/40 dark:ring-zinc-700/40',
}
