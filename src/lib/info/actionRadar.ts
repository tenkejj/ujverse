import { matchesFaculty } from './faculty'
import { isRegistrationVerified, registrationTiming } from './relevance'
import { DAY_MS, HOUR_MS } from './time'
import type { InfoAnnouncement, InfoRegistration } from './types'

export type RadarAction = {
  /** Includes the meaningful source revision, so a changed deadline becomes unread again. */
  key: string
  kind: 'registration' | 'announcement'
  title: string
  action: string
  instruction: string
  sourceUrl: string
  sourceLabel: string
  faculty: string | null
  tone: 'urgent' | 'open' | 'upcoming' | 'cancelled' | 'remote' | 'unconfirmed'
  date: string | null
  dateLabel: string
  evidenceAt: string | null
  evidenceLabel: string
  caution: string | null
  score: number
}

export type RadarInput = {
  faculty: string | null
  announcements: readonly InfoAnnouncement[]
  registrations: readonly InfoRegistration[]
  latestRegistrationVerifiedAt: string | null
  now: Date
  limit?: number
}

const RECENT_CHANGE_MS = 72 * HOUR_MS
const UPCOMING_WINDOW_MS = 7 * DAY_MS

/** Task suggestions require an explicit official source, not an AI interpretation. */
export function radarSourceUrl(raw: string | null): string | null {
  if (!raw || raw.length > 2048) return null
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (
      host !== 'uj.edu.pl' &&
      !host.endsWith('.uj.edu.pl') &&
      host !== 'cm-uj.krakow.pl' &&
      !host.endsWith('.cm-uj.krakow.pl')
    )
      return null
    return url.toString()
  } catch {
    return null
  }
}

function fingerprint(parts: readonly unknown[]): string {
  const text = JSON.stringify(parts)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function buildRadarActions(input: RadarInput): RadarAction[] {
  const actions: RadarAction[] = []
  const nowMs = input.now.getTime()
  if (!Number.isFinite(nowMs)) return actions

  for (const item of input.registrations) {
    if (!item.turaId || !matchesFaculty(item.faculty, input.faculty)) continue
    const sourceUrl = radarSourceUrl(item.url)
    const opens = Date.parse(item.opensAt)
    const closes = item.closesAt ? Date.parse(item.closesAt) : null
    if (!sourceUrl || !Number.isFinite(opens)) continue
    if (closes !== null && (!Number.isFinite(closes) || closes <= opens))
      continue
    const timing = registrationTiming(item, input.now)
    if (timing.phase === 'closed') continue
    if (timing.phase === 'upcoming' && timing.msUntilOpen > UPCOMING_WINDOW_MS)
      continue
    const evidenceMs = Date.parse(item.verifiedAt)
    const verified =
      Number.isFinite(evidenceMs) &&
      evidenceMs <= nowMs + 5 * 60_000 &&
      isRegistrationVerified(
        item,
        input.now,
        input.latestRegistrationVerifiedAt,
      )
    const closingSoon =
      verified && timing.phase === 'open' && timing.urgency !== 'none'
    const tone = !verified
      ? 'unconfirmed'
      : closingSoon
        ? 'urgent'
        : timing.phase
    actions.push({
      key: `registration:${item.id}:${fingerprint([item.title, opens, closes, sourceUrl])}`,
      kind: 'registration',
      title: item.title,
      action: !verified
        ? 'Potwierdź termin rejestracji'
        : timing.phase === 'open'
          ? 'Sprawdź dostępne grupy'
          : 'Przygotuj się do zapisów',
      instruction:
        'Otwórz rejestrację w USOSweb i sprawdź, czy obejmuje Twój kierunek, rok i etap studiów.',
      sourceUrl,
      sourceLabel: 'USOSweb',
      faculty: item.faculty,
      tone,
      date: timing.phase === 'open' ? item.closesAt : item.opensAt,
      dateLabel: timing.phase === 'open' ? 'Zapisy do' : 'Zapisy od',
      evidenceAt:
        Number.isFinite(evidenceMs) && evidenceMs <= nowMs + 5 * 60_000
          ? item.verifiedAt
          : null,
      evidenceLabel: 'Termin potwierdzony w USOSweb',
      caution: verified
        ? null
        : 'Dane wymagają ponownego potwierdzenia. Sprawdź aktualny termin w USOSweb.',
      score: !verified
        ? 20
        : closingSoon
          ? timing.urgency === 'closing-critical'
            ? 100
            : 85
          : timing.phase === 'open'
            ? 75
            : 60,
    })
  }

  for (const item of input.announcements) {
    if (item.status !== 'cancelled' && item.status !== 'remote') continue
    if (!matchesFaculty(item.faculty, input.faculty)) continue
    const sourceUrl = radarSourceUrl(item.sourceUrl)
    const addedMs = Date.parse(item.addedAt)
    if (
      !sourceUrl ||
      !Number.isFinite(addedMs) ||
      addedMs > nowMs ||
      nowMs - addedMs > RECENT_CHANGE_MS
    )
      continue
    actions.push({
      key: `announcement:${item.id}:${fingerprint([item.status, item.title, item.body, sourceUrl])}`,
      kind: 'announcement',
      title: item.title,
      action:
        item.status === 'cancelled'
          ? 'Sprawdź komunikat o odwołaniu'
          : 'Sprawdź zmianę organizacji zajęć',
      instruction:
        'Sprawdź, których zajęć i dat dotyczy komunikat. W razie wątpliwości potwierdź zmianę u prowadzącego.',
      sourceUrl,
      sourceLabel: item.sourceIsListing
        ? 'Lista komunikatów wydziału'
        : item.sourceLabel,
      faculty: item.faculty,
      tone: item.status,
      date: null,
      dateLabel: '',
      evidenceAt: item.addedAt,
      evidenceLabel: 'Dodano komunikat do UJverse',
      caution: 'Komunikat nie potwierdza automatycznie zmiany Twojego planu.',
      score: item.status === 'cancelled' ? 90 : 70,
    })
  }

  actions.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(a.date ?? a.evidenceAt ?? '') -
        Date.parse(b.date ?? b.evidenceAt ?? '') ||
      a.key.localeCompare(b.key),
  )
  const unique = [
    ...new Map(actions.map((action) => [action.key, action])).values(),
  ]
  const limit = Number.isFinite(input.limit) ? Math.floor(input.limit!) : 6
  return unique.slice(0, Math.max(0, Math.min(12, limit)))
}
