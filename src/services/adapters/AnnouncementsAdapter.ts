import { supabase } from '../../supabaseClient'
import { UjverseSanitizer } from '../../lib/sanitizer'
import { activeAnnouncementCutoff } from '../../lib/announcementRecency'
import type {
  AnnouncementMeta,
  AnnouncementStatus,
  UnifiedContent,
} from '../../types/content'
import {
  isAnnouncementExtractedCalendar,
  type AnnouncementExtractedCalendar,
} from '../../types/calendar'
import type { ContentAdapter, Unsubscribe } from './BaseAdapter'

/** Surowy rekord z tabeli `announcements` (shape ze scrapera ISI UJ). */
export type AnnouncementRow = {
  id: string
  body_fingerprint: string | null
  department: string | null
  source: string | null
  lecturer_name: string
  body: string
  status: AnnouncementStatus
  created_at: string
  /** Bielik TL;DR (migracja 20260623100000). `null` przed ekstrakcją. */
  summary: string | null
  /** Bielik kalendarz (migracja 20260621100000). `null` jeśli brak ramki czasowej. */
  extracted_calendar: AnnouncementExtractedCalendar | null
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
  if (status !== 'cancelled' && status !== 'remote' && status !== 'duty') return null

  const pickStringOrNull = (v: unknown): string | null =>
    typeof v === 'string' ? v : v === null || v === undefined ? null : null

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
    lecturer_name,
    body,
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

  async fetch(): Promise<AnnouncementRow[]> {
    // Sync cutoff z desktopowym `AcademicAnnouncementsWidget` (mobile `AnnouncementPills`
    // wcześniej widział pełną historię). `activeAnnouncementCutoff()` używa
    // `ACTIVE_ANNOUNCEMENT_DAYS` z `lib/announcementRecency.ts` jako jedynego
    // źródła prawdy — zmiana okna w jednym miejscu propaguje się do query.
    const since = activeAnnouncementCutoff().toISOString()
    const { data, error } = await supabase
      .from('announcements')
      .select(
        'id, body_fingerprint, department, source, lecturer_name, body, status, created_at, summary, extracted_calendar',
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }
    if (!Array.isArray(data)) return []
    return data
      .map((r) => parseRow(r as Record<string, unknown>))
      .filter((x): x is AnnouncementRow => x !== null)
  }

  toUnified(raw: AnnouncementRow): UnifiedContent<AnnouncementMeta> | null {
    const author = UjverseSanitizer.cleanAuthor(raw.lecturer_name)
    const body = UjverseSanitizer.cleanBody(raw.body)
    if (!author && !body) return null

    return {
      id: raw.id,
      type: 'announcement',
      title: author,
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
        department: raw.department,
        bodyFingerprint: raw.body_fingerprint,
        summary: raw.summary,
        extractedCalendar: raw.extracted_calendar,
      },
      actions: [],
    }
  }

  /** Pełna pipelina: fetch -> toUnified -> posortowane (cancelled pierwsze, potem desc by created_at). */
  async list(): Promise<UnifiedContent<AnnouncementMeta>[]> {
    const raws = await this.fetch()
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
