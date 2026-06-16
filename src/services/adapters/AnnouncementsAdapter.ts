import { supabase } from '../../supabaseClient'
import { UjverseSanitizer } from '../../lib/sanitizer'
import {
  activeAnnouncementCutoff,
  LIST_ANNOUNCEMENTS_LIMIT,
} from '../../lib/announcementRecency'
import type {
  AnnouncementMeta,
  AnnouncementSourceKind,
  AnnouncementStatus,
  UnifiedContent,
} from '../../types/content'
import {
  isAnnouncementExtractedCalendar,
  type AnnouncementExtractedCalendar,
} from '../../types/calendar'
import type { ContentAdapter, Unsubscribe } from './BaseAdapter'

/**
 * Surowy rekord z tabeli `announcements`. Shape pokrywa wszystkie 3 parsery
 * (ISI Drupal, Liferay UJ, WordPress Collegium Medicum) — pola `title` /
 * `source_url` są nullable, bo ISI Drupal nie wystawia ich osobno.
 *
 * Migracje: 20260412 (base), 20260413 (body_fingerprint), 20260414 (source),
 * 20260621 (extracted_calendar), 20260624 (summary),
 * 20260715120000 (title + source_url + source_kind + status 'info'/'event'),
 * 20260715130000 (full_body — pełna treść z source_url, drugi pass scrapera).
 */
export type AnnouncementRow = {
  id: string
  body_fingerprint: string | null
  department: string | null
  source: string | null
  source_kind: AnnouncementSourceKind | null
  source_url: string | null
  title: string | null
  lecturer_name: string
  /**
   * Tekst widoczny na listings (excerpt z Liferay/WP CM, pełna treść z ISI Drupal
   * lub komunikatach manualnych). Stabilne źródło `body_fingerprint`, dlatego
   * scraper drugiego passu NIE nadpisuje go.
   */
  body: string
  /**
   * Pełna treść artykułu z `source_url` (migracja 20260715130000). `null` dla:
   * - ISI Drupal i manualnych (mają już pełną treść w `body`)
   * - rzędów świeżo utworzonych przed pierwszym cyklem drugiego passu
   * - rzędów gdzie fetch się nie udał (404 / parser nic nie złapał).
   *
   * Frontend preferuje `full_body` nad `body` — szczegółowy tekst pokazujemy
   * w drawer / card body, ale fingerprint i dedup są nieruszone.
   */
  full_body: string | null
  status: AnnouncementStatus
  created_at: string
  /** Bielik TL;DR (migracja 20260623100000). `null` przed ekstrakcją. */
  summary: string | null
  /** Bielik kalendarz (migracja 20260621100000). `null` jeśli brak ramki czasowej. */
  extracted_calendar: AnnouncementExtractedCalendar | null
}

const ALLOWED_STATUSES = new Set<AnnouncementStatus>([
  'cancelled',
  'remote',
  'duty',
  'info',
  'event',
])

const ALLOWED_SOURCE_KINDS = new Set<AnnouncementSourceKind>([
  'isi_drupal',
  'liferay',
  'wordpress_cm',
  'manual',
])

/** Kolumny listy — BEZ `full_body` (lazy-load w `fetchById` przy „rozwiń”). */
const LIST_SELECT =
  'id, body_fingerprint, department, source, source_kind, source_url, title, lecturer_name, body, status, created_at, summary, extracted_calendar'

/** Pojedynczy rekord — z pełną treścią artykułu. */
const DETAIL_SELECT = `${LIST_SELECT}, full_body`

export type AnnouncementsFetchOpts = {
  /** Filtr po `announcements.department` (aliasy z `departmentGroup`). */
  departments?: string[]
  limit?: number
}

function parseRow(row: Record<string, unknown>): AnnouncementRow | null {
  const id = row.id
  const lecturer_name = row.lecturer_name
  const body = row.body
  const status = row.status
  const created_at = row.created_at
  if (typeof id !== 'string' || typeof lecturer_name !== 'string' || typeof body !== 'string') {
    return null
  }
  if (typeof created_at !== 'string') return null
  if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status as AnnouncementStatus)) return null

  const pickStringOrNull = (v: unknown): string | null =>
    typeof v === 'string' ? v : v === null || v === undefined ? null : null

  const sourceKindRaw = pickStringOrNull(row.source_kind)
  const sourceKind: AnnouncementSourceKind | null =
    sourceKindRaw && ALLOWED_SOURCE_KINDS.has(sourceKindRaw as AnnouncementSourceKind)
      ? (sourceKindRaw as AnnouncementSourceKind)
      : null

  // `summary` z DB to TEXT z CHECK length<=400; jednak na froncie używamy
  // ≤280, więc capujemy żeby chronić layout karty na wąskich ekranach.
  const summaryRaw = pickStringOrNull(row.summary)
  const summary =
    summaryRaw === null
      ? null
      : summaryRaw.trim().length === 0
        ? null
        : summaryRaw.trim().length > 280
          ? summaryRaw.trim().slice(0, 280)
          : summaryRaw.trim()

  // `extracted_calendar` przychodzi z PostgREST jako już sparsowany obiekt
  // (kolumna JSONB). Jeśli nie zgadza się ze schematem — `null`, UI nie
  // pokaże badge.
  const extractedCalendar = isAnnouncementExtractedCalendar(row.extracted_calendar)
    ? (row.extracted_calendar as AnnouncementExtractedCalendar)
    : null

  return {
    id,
    body_fingerprint: pickStringOrNull(row.body_fingerprint),
    department: pickStringOrNull(row.department),
    source: pickStringOrNull(row.source),
    source_kind: sourceKind,
    source_url: pickStringOrNull(row.source_url),
    title: pickStringOrNull(row.title),
    lecturer_name,
    body,
    full_body: pickStringOrNull(row.full_body),
    status: status as AnnouncementStatus,
    created_at,
    summary,
    extracted_calendar: extractedCalendar,
  }
}

/**
 * Adapter komunikatów akademickich.
 *
 * Źródło: Supabase (`announcements`) + realtime channel. Cała logika parsowania,
 * sortowania i sanityzacji LLM-noise przechodzi przez UjverseSanitizer.
 */
class AnnouncementsAdapterImpl
  implements ContentAdapter<AnnouncementRow, AnnouncementMeta>
{
  readonly type = 'announcement' as const

  async fetch(opts?: AnnouncementsFetchOpts): Promise<AnnouncementRow[]> {
    // Sync cutoff z desktopowym `AcademicAnnouncementsWidget` (mobile `AnnouncementPills`
    // wcześniej widział pełną historię). `activeAnnouncementCutoff()` używa
    // `ACTIVE_ANNOUNCEMENT_DAYS` z `lib/announcementRecency.ts` jako jedynego
    // źródła prawdy — zmiana okna w jednym miejscu propaguje się do query.
    const since = activeAnnouncementCutoff().toISOString()
    const limit = opts?.limit ?? LIST_ANNOUNCEMENTS_LIMIT
    let query = supabase
      .from('announcements')
      .select(LIST_SELECT)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    const depts = opts?.departments?.filter((d) => d.trim().length > 0)
    if (depts && depts.length > 0) {
      query = query.in('department', depts)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }
    if (!Array.isArray(data)) return []
    return data
      .map((r) => parseRow(r as Record<string, unknown>))
      .filter((x): x is AnnouncementRow => x !== null)
  }

  /** Pełna treść jednego komunikatu — wywoływane lazy przy „rozwiń” w karcie. */
  async fetchById(id: string): Promise<AnnouncementRow | null> {
    const { data, error } = await supabase
      .from('announcements')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    if (!data) return null
    return parseRow(data as Record<string, unknown>)
  }

  toUnified(raw: AnnouncementRow): UnifiedContent<AnnouncementMeta> | null {
    const author = UjverseSanitizer.cleanAuthor(raw.lecturer_name)
    // Preferuj pełną treść z drugiego passu scrapera; gdy brak — listings
    // excerpt jako fallback. `body_fingerprint` zawsze liczony z `raw.body`,
    // więc deduplikacja jest niezaburzona.
    const bodyText = raw.full_body ?? raw.body
    const body = UjverseSanitizer.cleanBody(bodyText)
    if (!author && !body) return null

    // Dla Liferay/WP `title` jest realnym tytułem komunikatu — używamy go
    // jako głównego headline'a. Dla ISI Drupal `title` to null → fallback
    // do author (lecturer name) jak dotychczas.
    const headline = raw.title?.trim() ?? ''
    const displayTitle = headline.length > 0 ? headline : author

    return {
      id: raw.id,
      type: 'announcement',
      title: displayTitle,
      author: {
        id: `lecturer:${UjverseSanitizer.slugify(author) || raw.id}`,
        displayName: author || 'Prowadzący',
        subtitle: raw.department,
        avatarUrl: null,
      },
      body,
      timestamp: raw.created_at,
      badges: [],
      metadata: {
        status: raw.status,
        source: raw.source,
        sourceKind: raw.source_kind,
        sourceUrl: raw.source_url,
        title: raw.title,
        department: raw.department,
        bodyFingerprint: raw.body_fingerprint,
        summary: raw.summary,
        extractedCalendar: raw.extracted_calendar,
      },
      actions: [],
    }
  }

  /**
   * Pełna pipelina: fetch -> toUnified -> posortowane.
   *
   * Sort priority:
   *   1. `cancelled` na górze (silny sygnał — nie przegap odwołania zajęć).
   *   2. Pozostałe (remote/duty/info/event) — chronologicznie desc po
   *      `created_at`.
   *
   * DataService dodaje finalny sort po dacie globalnie, ale ten lokalny
   * priorytet zachowujemy żeby cancelled lecturer-blocks z ISI nie schodziły
   * pod informacyjne komunikaty Liferay/WP z tego samego tygodnia.
   */
  async list(opts?: AnnouncementsFetchOpts): Promise<UnifiedContent<AnnouncementMeta>[]> {
    const raws = await this.fetch(opts)
    const unified = raws
      .map((r) => this.toUnified(r))
      .filter((x): x is UnifiedContent<AnnouncementMeta> => x !== null)

    return unified.sort((a, b) => {
      const ac = a.metadata.status === 'cancelled' ? 0 : 1
      const bc = b.metadata.status === 'cancelled' ? 0 : 1
      if (ac !== bc) return ac - bc
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
  }

  /** Realtime: subskrypcja INSERT/UPDATE, odpalany callback bez danych (UI zrobi refetch). */
  subscribe(onChange: () => void): Unsubscribe {
    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        () => onChange(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }
}

export const AnnouncementsAdapter = new AnnouncementsAdapterImpl()
