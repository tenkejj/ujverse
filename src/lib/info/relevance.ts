/**
 * Deterministyczne reguły ważności i sortowania (bez AI, bez heurystyk tekstowych).
 *
 * Pilność wynika wyłącznie z metadanych: terminów rejestracji potwierdzonych
 * przez scraper USOSweb i statusu komunikatu nadanego przez parser źródła.
 */
import { matchesFaculty } from './faculty'
import { DAY_MS, HOUR_MS, warsawDayKey } from './time'
import type { InfoAnnouncement, InfoEvent, InfoRegistration } from './types'

export type RegistrationPhase = 'open' | 'upcoming' | 'closed'
export type RegistrationUrgency = 'closing-critical' | 'closing-soon' | 'opening-soon' | 'none'

export type RegistrationTiming = {
  phase: RegistrationPhase
  urgency: RegistrationUrgency
  msUntilOpen: number
  msUntilClose: number | null
}

export const CLOSING_CRITICAL_MS = 24 * HOUR_MS
export const SOON_WINDOW_MS = 72 * HOUR_MS
/** Odliczanie („zostało 2 dni") tylko dla terminów w tym horyzoncie. */
export const COUNTDOWN_WINDOW_MS = 7 * DAY_MS
/** Wiersz uznajemy za potwierdzony, jeśli scraper widział go w ciągu 48 h… */
export const VERIFIED_MAX_AGE_MS = 48 * HOUR_MS
/** …i nie odstaje o więcej niż dobę od ostatniego przebiegu scrapera. */
export const VERIFIED_RUN_SLACK_MS = 24 * HOUR_MS
/** Scraper działa 2× dziennie — brak przebiegu przez 36 h oznacza nieaktualne dane. */
export const REGISTRATIONS_STALE_MS = 36 * HOUR_MS
export const PRIORITY_ANNOUNCEMENT_WINDOW_MS = 72 * HOUR_MS
export const PRIORITY_LIMIT = 4

export function registrationTiming(reg: InfoRegistration, now: Date): RegistrationTiming {
  const t = now.getTime()
  const opens = Date.parse(reg.opensAt)
  const closes = reg.closesAt ? Date.parse(reg.closesAt) : null
  const msUntilOpen = opens - t
  const msUntilClose = closes === null ? null : closes - t

  if (closes !== null && closes <= t) {
    return { phase: 'closed', urgency: 'none', msUntilOpen, msUntilClose }
  }
  if (opens <= t) {
    let urgency: RegistrationUrgency = 'none'
    if (msUntilClose !== null && msUntilClose <= CLOSING_CRITICAL_MS) urgency = 'closing-critical'
    else if (msUntilClose !== null && msUntilClose <= SOON_WINDOW_MS) urgency = 'closing-soon'
    return { phase: 'open', urgency, msUntilOpen, msUntilClose }
  }
  return {
    phase: 'upcoming',
    urgency: msUntilOpen <= SOON_WINDOW_MS ? 'opening-soon' : 'none',
    msUntilOpen,
    msUntilClose,
  }
}

export function isRegistrationVerified(
  reg: InfoRegistration,
  now: Date,
  latestVerifiedAt: string | null,
): boolean {
  const verified = Date.parse(reg.verifiedAt)
  if (Number.isNaN(verified)) return false
  if (now.getTime() - verified > VERIFIED_MAX_AGE_MS) return false
  if (latestVerifiedAt) {
    const latest = Date.parse(latestVerifiedAt)
    if (!Number.isNaN(latest) && latest - verified > VERIFIED_RUN_SLACK_MS) return false
  }
  return true
}

export function isRegistrationDataStale(latestVerifiedAt: string | null, now: Date): boolean {
  if (!latestVerifiedAt) return true
  const latest = Date.parse(latestVerifiedAt)
  return Number.isNaN(latest) || now.getTime() - latest > REGISTRATIONS_STALE_MS
}

/** Czy można pokazać odliczanie: dane potwierdzone i termin w horyzoncie tygodnia. */
export function canShowCountdown(
  reg: InfoRegistration,
  timing: RegistrationTiming,
  now: Date,
  latestVerifiedAt: string | null,
): boolean {
  if (!isRegistrationVerified(reg, now, latestVerifiedAt)) return false
  if (timing.phase === 'open') {
    return timing.msUntilClose !== null && timing.msUntilClose <= COUNTDOWN_WINDOW_MS
  }
  if (timing.phase === 'upcoming') return timing.msUntilOpen <= COUNTDOWN_WINDOW_MS
  return false
}

function byIdThenTitle(a: { id: string; title: string }, b: { id: string; title: string }): number {
  return a.title.localeCompare(b.title, 'pl') || a.id.localeCompare(b.id)
}

/** Trwające (najbliższe zamknięcie) → nadchodzące (najbliższe otwarcie); zakończone odpadają. */
export function activeRegistrationsSorted(
  regs: readonly InfoRegistration[],
  now: Date,
): InfoRegistration[] {
  const withTiming = regs
    .map((reg) => ({ reg, timing: registrationTiming(reg, now) }))
    .filter(({ timing }) => timing.phase !== 'closed')
  withTiming.sort((a, b) => {
    const pa = a.timing.phase === 'open' ? 0 : 1
    const pb = b.timing.phase === 'open' ? 0 : 1
    if (pa !== pb) return pa - pb
    if (pa === 0) {
      const ca = a.timing.msUntilClose ?? Number.POSITIVE_INFINITY
      const cb = b.timing.msUntilClose ?? Number.POSITIVE_INFINITY
      if (ca !== cb) return ca - cb
    } else if (a.timing.msUntilOpen !== b.timing.msUntilOpen) {
      return a.timing.msUntilOpen - b.timing.msUntilOpen
    }
    return byIdThenTitle(a.reg, b.reg)
  })
  return withTiming.map(({ reg }) => reg)
}

export function sortAnnouncementsNewestFirst(
  items: readonly InfoAnnouncement[],
): InfoAnnouncement[] {
  return [...items].sort((a, b) => {
    const diff = Date.parse(b.addedAt) - Date.parse(a.addedAt)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })
}

/** Wydarzenia od dzisiaj (dzień warszawski) w kolejności dat. */
export function upcomingEventsSorted(events: readonly InfoEvent[], now: Date): InfoEvent[] {
  const today = warsawDayKey(now)
  return events
    .filter((ev) => ev.dayKey >= today)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || byIdThenTitle(a, b))
}

export type PriorityItem =
  | {
      kind: 'registration'
      key: string
      score: number
      at: number
      reason: 'registration-closing' | 'registration-opening'
      item: InfoRegistration
    }
  | {
      kind: 'announcement'
      key: string
      score: number
      at: number
      reason: 'cancelled' | 'remote'
      item: InfoAnnouncement
    }

/**
 * „Ważne teraz" — tylko dla wybranego wydziału:
 *   100  rejestracja zamyka się w ciągu 24 h
 *    90  odwołane zajęcia dodane w ostatnich 72 h
 *    85  rejestracja zamyka się w ciągu 72 h
 *    75  zajęcia zdalne dodane w ostatnich 72 h
 *    70  rejestracja otwiera się w ciągu 72 h
 * Rejestracje niepotwierdzone w ostatnim przebiegu scrapera nie są eskalowane.
 * Remis: rejestracje — bliższy termin; komunikaty — nowszy; potem klucz.
 */
export function buildPriorityItems(input: {
  faculty: string | null
  announcements: readonly InfoAnnouncement[]
  registrations: readonly InfoRegistration[]
  now: Date
  latestRegistrationVerifiedAt: string | null
  limit?: number
}): PriorityItem[] {
  const { faculty, now } = input
  if (!faculty) return []
  const t = now.getTime()
  const out: PriorityItem[] = []

  for (const reg of input.registrations) {
    if (!matchesFaculty(reg.faculty, faculty)) continue
    if (!isRegistrationVerified(reg, now, input.latestRegistrationVerifiedAt)) continue
    const timing = registrationTiming(reg, now)
    if (timing.urgency === 'closing-critical' || timing.urgency === 'closing-soon') {
      out.push({
        kind: 'registration',
        key: `registration:${reg.id}`,
        score: timing.urgency === 'closing-critical' ? 100 : 85,
        at: Date.parse(reg.closesAt ?? reg.opensAt),
        reason: 'registration-closing',
        item: reg,
      })
    } else if (timing.urgency === 'opening-soon') {
      out.push({
        kind: 'registration',
        key: `registration:${reg.id}`,
        score: 70,
        at: Date.parse(reg.opensAt),
        reason: 'registration-opening',
        item: reg,
      })
    }
  }

  for (const ann of input.announcements) {
    if (ann.status !== 'cancelled' && ann.status !== 'remote') continue
    if (!matchesFaculty(ann.faculty, faculty)) continue
    const added = Date.parse(ann.addedAt)
    const age = t - added
    if (Number.isNaN(added) || age < 0 || age > PRIORITY_ANNOUNCEMENT_WINDOW_MS) continue
    out.push({
      kind: 'announcement',
      key: `announcement:${ann.id}`,
      score: ann.status === 'cancelled' ? 90 : 75,
      at: added,
      reason: ann.status,
      item: ann,
    })
  }

  out.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    const byTime = a.kind === 'registration' ? a.at - b.at : b.at - a.at
    return byTime !== 0 ? byTime : a.key.localeCompare(b.key)
  })
  return out.slice(0, input.limit ?? PRIORITY_LIMIT)
}
