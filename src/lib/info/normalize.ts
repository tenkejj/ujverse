/**
 * Normalizacja surowych rekordów Supabase → kontrakty `InfoItem` + deduplikacja.
 *
 * Czysty moduł (bez Supabase/React) — testowany w `tests/`.
 * Rekordy, którym brakuje pól wymaganych do uczciwej prezentacji, są pomijane.
 */
import type { AnnouncementStatus } from '../../types/content'
import { REGISTRATION_KINDS, type RegistrationKind } from '../../types/usosRegistrations'
import { UjverseSanitizer } from '../sanitizer'
import {
  facultyFromUsosUnitCode,
  facultyListingSource,
  facultyShortLabel,
  toKnownFaculty,
  usosUnitCatalogUrl,
} from './faculty'
import { safeExternalUrl, urlDedupKey } from './links'
import type { InfoAnnouncement, InfoEvent, InfoRegistration } from './types'
import { MINUTE_MS, parseIsoDate, warsawDayKey } from './time'

type Row = Record<string, unknown>

const ANNOUNCEMENT_STATUSES = new Set<AnnouncementStatus>([
  'cancelled',
  'remote',
  'duty',
  'info',
  'event',
])

const REGISTRATION_KIND_SET = new Set<string>(REGISTRATION_KINDS)

/** `lecturer_name` wpisywany przez parsery dla komunikatów bez konkretnej osoby. */
const GENERIC_LECTURER_RE = /^komunikat(y)?\b/i

/** Lokalizacje-wypełniacze z `api/scrape-uj-events.ts` — nie niosą informacji o miejscu. */
const PLACEHOLDER_LOCATIONS = new Set([
  'uniwersytet jagielloński, kraków',
  'wziks uj, kraków',
  'kraków',
])
const PLACEHOLDER_DESCRIPTION = 'treść z oficjalnego serwisu uj.'

/** Scraper wydarzeń wpisuje czas pobrania, gdy nie znajdzie daty — takie rekordy pomijamy. */
const EVENT_DATE_FALLBACK_WINDOW_MS = 10 * MINUTE_MS

const EXCERPT_MAX = 220

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Skraca tekst na granicy słowa. */
export function makeExcerpt(text: string, max = EXCERPT_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:–-]+$/, '')}…`
}

/** Porównywalny tytuł: małe litery, bez znaków diakrytycznych i interpunkcji. */
export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

export function normalizeAnnouncement(row: Row): InfoAnnouncement | null {
  const id = str(row.id)
  const rawBody = typeof row.body === 'string' ? row.body : null
  const status = str(row.status)
  const addedAt = parseIsoDate(row.created_at)
  if (!id || rawBody === null || !addedAt) return null
  if (!status || !ANNOUNCEMENT_STATUSES.has(status as AnnouncementStatus)) return null

  const body = UjverseSanitizer.cleanBody(rawBody)
  const rawLecturer = str(row.lecturer_name)
  const lecturer =
    rawLecturer && !GENERIC_LECTURER_RE.test(rawLecturer)
      ? UjverseSanitizer.cleanAuthor(rawLecturer) || null
      : null
  const parsedTitle = str(row.title) ? UjverseSanitizer.cleanTitle(String(row.title)) : ''
  const title = parsedTitle || lecturer || makeExcerpt(body, 90)
  if (!title) return null

  const faculty = toKnownFaculty(str(row.department))
  const ownUrl = safeExternalUrl(str(row.source_url))
  const listing = ownUrl ? null : facultyListingSource(faculty)
  const sourceKind = str(row.source_kind)
  const summaryRaw = str(row.summary)

  return {
    kind: 'announcement',
    id,
    title,
    excerpt: makeExcerpt(body),
    body,
    faculty,
    facultyShort: facultyShortLabel(faculty),
    sourceLabel: str(row.source) ?? listing?.label ?? 'Strona wydziału',
    sourceUrl: ownUrl ?? listing?.url ?? null,
    sourceIsListing: !ownUrl && Boolean(listing),
    status: status as AnnouncementStatus,
    addedAt: addedAt.toISOString(),
    summary: summaryRaw ? summaryRaw.slice(0, 280) : null,
    lecturerName: lecturer,
    mayHaveFullBody: sourceKind === 'liferay' || sourceKind === 'wordpress_cm',
  }
}

export function normalizeRegistration(row: Row): InfoRegistration | null {
  const id = str(row.id)
  const turaId = str(row.source_usos_tura_id)
  const title = str(row.title)
  const opens = parseIsoDate(row.opens_at)
  const verified = parseIsoDate(row.updated_at)
  if (!id || !turaId || !title || !opens || !verified) return null

  const closesRaw = row.closes_at
  const closes = closesRaw == null ? null : parseIsoDate(closesRaw)
  if (closesRaw != null && !closes) return null
  if (closes && closes.getTime() <= opens.getTime()) return null

  const unitCode = str(row.source_unit_code)
  const faculty = facultyFromUsosUnitCode(unitCode)
  const description = str(row.description)
  const code = description?.match(/Kod rejestracji USOSweb:\s*(\S+)/)?.[1] ?? null
  const kindRaw = str(row.kind)
  const registrationKind: RegistrationKind =
    kindRaw && REGISTRATION_KIND_SET.has(kindRaw) ? (kindRaw as RegistrationKind) : 'inne'

  return {
    kind: 'registration',
    id,
    turaId,
    title: UjverseSanitizer.normalizeTypography(title),
    code,
    unitName: str(row.audience_label),
    unitCode,
    faculty,
    facultyShort: facultyShortLabel(faculty),
    opensAt: opens.toISOString(),
    closesAt: closes ? closes.toISOString() : null,
    url: safeExternalUrl(str(row.registration_url)) ?? usosUnitCatalogUrl(unitCode),
    registrationKind,
    verifiedAt: verified.toISOString(),
  }
}

function isNewsArticleUrl(url: string | null): boolean {
  if (!url) return false
  try {
    const { pathname } = new URL(url)
    return pathname === '/wiadomosci' || pathname.includes('/wiadomosci/')
  } catch {
    return false
  }
}

export function normalizeOfficialEvent(row: Row): InfoEvent | null {
  const id = str(row.id)
  const externalId = str(row.external_id)
  const rawTitle = str(row.title)
  const date = parseIsoDate(row.date)
  if (!id || !externalId || !rawTitle || !date) return null

  const url = safeExternalUrl(str(row.event_url))
  if (isNewsArticleUrl(url)) return null

  const seen = parseIsoDate(row.scraped_at)
  if (seen && Math.abs(date.getTime() - seen.getTime()) < EVENT_DATE_FALLBACK_WINDOW_MS) return null

  const locationRaw = str(row.location)
  const location =
    locationRaw && !PLACEHOLDER_LOCATIONS.has(locationRaw.toLowerCase()) ? locationRaw : null
  const descriptionRaw = str(row.description) ?? ''
  const description =
    descriptionRaw.toLowerCase() === PLACEHOLDER_DESCRIPTION ? '' : makeExcerpt(descriptionRaw, 260)
  const category = str(row.category)

  return {
    kind: 'event',
    id,
    externalId,
    title: UjverseSanitizer.normalizeTypography(rawTitle),
    description,
    dayKey: warsawDayKey(date),
    date: date.toISOString(),
    location,
    category: category && category !== 'Oficjalne' ? category : null,
    sourceName: str(row.source_name) ?? 'Uniwersytet Jagielloński',
    url,
    seenAt: seen ? seen.toISOString() : null,
  }
}

export function normalizeRows<T>(rows: unknown, fn: (row: Row) => T | null): T[] {
  if (!Array.isArray(rows)) return []
  const out: T[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = fn(row as Row)
    if (item) out.push(item)
  }
  return out
}

/**
 * Ten sam artykuł bywa pobrany dwa razy z innym fragmentem treści (inny
 * fingerprint). Łączymy wyłącznie identyczne linki do konkretnego ogłoszenia —
 * podobne tytuły różnych komunikatów zostają osobno. Wygrywa najwcześniej dodany.
 */
export function dedupeAnnouncements(items: readonly InfoAnnouncement[]): InfoAnnouncement[] {
  const byKey = new Map<string, InfoAnnouncement>()
  const out: InfoAnnouncement[] = []
  for (const item of items) {
    const key = item.sourceIsListing ? null : urlDedupKey(item.sourceUrl)
    if (!key) {
      out.push(item)
      continue
    }
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      out.push(item)
      continue
    }
    if (item.addedAt < existing.addedAt) {
      out[out.indexOf(existing)] = item
      byKey.set(key, item)
    }
  }
  return out
}

/** Po `external_id`, potem identyczny znormalizowany tytuł tego samego dnia (to samo wydarzenie z dwóch list). */
export function dedupeEvents(items: readonly InfoEvent[]): InfoEvent[] {
  const seenExternal = new Set<string>()
  const seenDayTitle = new Set<string>()
  const out: InfoEvent[] = []
  for (const item of items) {
    if (seenExternal.has(item.externalId)) continue
    const dayTitle = `${item.dayKey}|${normalizeTitleKey(item.title)}`
    if (seenDayTitle.has(dayTitle)) continue
    seenExternal.add(item.externalId)
    seenDayTitle.add(dayTitle)
    out.push(item)
  }
  return out
}

export function dedupeRegistrations(items: readonly InfoRegistration[]): InfoRegistration[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.turaId)) return false
    seen.add(item.turaId)
    return true
  })
}

/** Najnowszy znacznik czasu z listy ISO (porównanie po wartości, nie po tekście). */
export function latestIso(values: ReadonlyArray<string | null | undefined>): string | null {
  let best: number | null = null
  for (const value of values) {
    const d = parseIsoDate(value)
    if (d && (best === null || d.getTime() > best)) best = d.getTime()
  }
  return best === null ? null : new Date(best).toISOString()
}
