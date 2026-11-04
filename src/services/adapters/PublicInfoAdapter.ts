/**
 * PublicInfoAdapter — publiczne odczyty warstwy informacyjnej.
 *
 * Działa identycznie dla gościa i zalogowanego: zapytania idą przez zwykły
 * klient anon, a granicę bezpieczeństwa wyznacza RLS (migracja
 * 20261104120000). Każde zapytanie ma jawną listę kolumn i limit;
 * kształtowanie danych robią czyste funkcje z `lib/info/normalize`.
 */
import { supabase } from '../../supabaseClient'
import { activeAnnouncementCutoff, LIST_ANNOUNCEMENTS_LIMIT } from '../../lib/announcementRecency'
import { warsawLocalToUtc } from '../../lib/warsawTime'
import { facultyDbValues } from '../../lib/info/faculty'
import {
  dedupeAnnouncements,
  dedupeEvents,
  dedupeRegistrations,
  latestIso,
  normalizeAnnouncement,
  normalizeOfficialEvent,
  normalizeRegistration,
  normalizeRows,
} from '../../lib/info/normalize'
import { orderByIds, orderEventSearchResults, toIlikePattern } from '../../lib/info/search'
import { DAY_MS, warsawDayKey } from '../../lib/info/time'
import type {
  DomainResult,
  InfoAnnouncement,
  InfoEvent,
  InfoRegistration,
} from '../../lib/info/types'

const ANNOUNCEMENT_COLUMNS =
  'id, department, source, source_kind, source_url, title, lecturer_name, body, status, created_at, summary'
const REGISTRATION_COLUMNS =
  'id, title, description, audience_label, opens_at, closes_at, registration_url, kind, source_usos_tura_id, source_unit_code, updated_at'
const EVENT_COLUMNS =
  'id, external_id, title, date, category, location, description, faculty, source_name, event_url, scraped_at'

const REGISTRATIONS_LIMIT = 200
const EVENTS_LIMIT = 60
/** Rejestracje bez daty końca uznajemy za aktywne tylko, gdy scraper widział je niedawno. */
const OPEN_ENDED_REGISTRATION_MAX_AGE_MS = 14 * DAY_MS

type QueryOpts = { signal?: AbortSignal }

function startOfWarsawTodayIso(now: Date): string {
  const [y, m, d] = warsawDayKey(now).split('-').map(Number)
  return warsawLocalToUtc(y, m, d, 0, 0).toISOString()
}

function fail(domain: string, message: string): never {
  throw new Error(`[${domain}] ${message}`)
}

class PublicInfoAdapterImpl {
  async listAnnouncements(
    opts: QueryOpts & { faculty?: string | null; limit?: number } = {},
  ): Promise<DomainResult<InfoAnnouncement>> {
    let query = supabase
      .from('announcements')
      .select(ANNOUNCEMENT_COLUMNS)
      .gte('created_at', activeAnnouncementCutoff().toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(opts.limit ?? LIST_ANNOUNCEMENTS_LIMIT)
    const departments = facultyDbValues(opts.faculty)
    if (departments.length > 0) query = query.in('department', departments)
    if (opts.signal) query = query.abortSignal(opts.signal)

    const { data, error } = await query
    if (error) fail('announcements', error.message)
    const items = dedupeAnnouncements(normalizeRows(data, normalizeAnnouncement))
    return {
      items,
      fetchedAt: new Date().toISOString(),
      freshness: { latest: latestIso(items.map((item) => item.addedAt)) },
    }
  }

  async fetchAnnouncementFullBody(id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('announcements')
      .select('full_body')
      .eq('id', id)
      .maybeSingle()
    if (error) fail('announcements', error.message)
    const body = (data as { full_body?: unknown } | null)?.full_body
    return typeof body === 'string' && body.trim().length > 0 ? body : null
  }

  /**
   * Trwające i nadchodzące rejestracje ze scrapera USOSweb + znacznik
   * ostatniego przebiegu scrapera (najnowsze `updated_at` w całej tabeli).
   */
  async listRegistrations(opts: QueryOpts = {}): Promise<DomainResult<InfoRegistration>> {
    const now = new Date()
    const nowIso = now.toISOString()
    const openEndedSince = new Date(now.getTime() - OPEN_ENDED_REGISTRATION_MAX_AGE_MS).toISOString()

    let listQuery = supabase
      .from('usos_registrations')
      .select(REGISTRATION_COLUMNS)
      .not('source_usos_tura_id', 'is', null)
      .or(`closes_at.gt.${nowIso},and(closes_at.is.null,updated_at.gt.${openEndedSince})`)
      .order('opens_at', { ascending: true })
      .limit(REGISTRATIONS_LIMIT)
    let latestQuery = supabase
      .from('usos_registrations')
      .select('updated_at')
      .not('source_usos_tura_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (opts.signal) {
      listQuery = listQuery.abortSignal(opts.signal)
      latestQuery = latestQuery.abortSignal(opts.signal)
    }

    const [list, latest] = await Promise.all([listQuery, latestQuery])
    if (list.error) fail('registrations', list.error.message)
    const items = dedupeRegistrations(normalizeRows(list.data, normalizeRegistration))
    const latestRow = latest.error ? null : (latest.data?.[0] as { updated_at?: unknown } | undefined)
    const latestRun = typeof latestRow?.updated_at === 'string' ? latestRow.updated_at : null
    return {
      items,
      fetchedAt: nowIso,
      freshness: { latest: latestIso([latestRun, ...items.map((item) => item.verifiedAt)]) },
    }
  }

  async listOfficialEvents(opts: QueryOpts = {}): Promise<DomainResult<InfoEvent>> {
    const now = new Date()
    let listQuery = supabase
      .from('official_events')
      .select(EVENT_COLUMNS)
      .gte('date', startOfWarsawTodayIso(now))
      .order('date', { ascending: true })
      .limit(EVENTS_LIMIT)
    let latestQuery = supabase
      .from('official_events')
      .select('scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1)
    if (opts.signal) {
      listQuery = listQuery.abortSignal(opts.signal)
      latestQuery = latestQuery.abortSignal(opts.signal)
    }

    const [list, latest] = await Promise.all([listQuery, latestQuery])
    if (list.error) fail('events', list.error.message)
    const items = dedupeEvents(normalizeRows(list.data, normalizeOfficialEvent))
    const latestRow = latest.error ? null : (latest.data?.[0] as { scraped_at?: unknown } | undefined)
    const latestRun = typeof latestRow?.scraped_at === 'string' ? latestRow.scraped_at : null
    return {
      items,
      fetchedAt: now.toISOString(),
      freshness: { latest: latestIso([latestRun, ...items.map((item) => item.seenAt)]) },
    }
  }

  /** Dociąga komunikaty po id (kolejność z rankingu wyszukiwarki). */
  async announcementsByIds(ids: readonly string[], opts: QueryOpts = {}): Promise<InfoAnnouncement[]> {
    const unique = [...new Set(ids)].slice(0, 30)
    if (unique.length === 0) return []
    let query = supabase.from('announcements').select(ANNOUNCEMENT_COLUMNS).in('id', unique)
    if (opts.signal) query = query.abortSignal(opts.signal)
    const { data, error } = await query
    if (error) fail('announcements', error.message)
    return orderByIds(normalizeRows(data, normalizeAnnouncement), unique)
  }

  async searchAnnouncements(
    text: string,
    opts: QueryOpts & { faculty?: string | null; limit?: number } = {},
  ): Promise<InfoAnnouncement[]> {
    const pattern = toIlikePattern(text)
    if (!pattern) return []
    let query = supabase
      .from('announcements')
      .select(ANNOUNCEMENT_COLUMNS)
      .or(`title.ilike.${pattern},body.ilike.${pattern},lecturer_name.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 20)
    const departments = facultyDbValues(opts.faculty)
    if (departments.length > 0) query = query.in('department', departments)
    if (opts.signal) query = query.abortSignal(opts.signal)
    const { data, error } = await query
    if (error) fail('announcements', error.message)
    return dedupeAnnouncements(normalizeRows(data, normalizeAnnouncement))
  }

  async searchRegistrations(
    text: string,
    opts: QueryOpts & { limit?: number } = {},
  ): Promise<InfoRegistration[]> {
    const pattern = toIlikePattern(text)
    if (!pattern) return []
    const nowIso = new Date().toISOString()
    let query = supabase
      .from('usos_registrations')
      .select(REGISTRATION_COLUMNS)
      .not('source_usos_tura_id', 'is', null)
      .or(`title.ilike.${pattern},audience_label.ilike.${pattern},description.ilike.${pattern}`)
      .gt('closes_at', nowIso)
      .order('opens_at', { ascending: true })
      .limit(opts.limit ?? 15)
    if (opts.signal) query = query.abortSignal(opts.signal)
    const { data, error } = await query
    if (error) fail('registrations', error.message)
    return dedupeRegistrations(normalizeRows(data, normalizeRegistration))
  }

  async searchOfficialEvents(
    text: string,
    opts: QueryOpts & { limit?: number } = {},
  ): Promise<InfoEvent[]> {
    const pattern = toIlikePattern(text)
    if (!pattern) return []
    const now = new Date()
    const since = new Date(now.getTime() - 90 * DAY_MS).toISOString()
    let query = supabase
      .from('official_events')
      .select(EVENT_COLUMNS)
      .gte('date', since)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order('date', { ascending: false })
      .limit(opts.limit ?? 20)
    if (opts.signal) query = query.abortSignal(opts.signal)
    const { data, error } = await query
    if (error) fail('events', error.message)
    return orderEventSearchResults(dedupeEvents(normalizeRows(data, normalizeOfficialEvent)), now)
  }
}

export const PublicInfoAdapter = new PublicInfoAdapterImpl()
