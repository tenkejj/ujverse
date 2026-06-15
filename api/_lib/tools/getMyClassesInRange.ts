/**
 * Tool: `get_my_classes_in_range`
 *
 * Personalny — zajęcia user'a w podanym zakresie + flaga „odwołane" gdy
 * dla wykładowcy istnieje świeży komunikat ze statusem `cancelled`.
 *
 * Powtarza logikę RPC `get_timetable_for_range` (migracja
 * 20260616120000_user_timetable.sql:77-130), ale wykonuje filter po
 * `user_id = ctx.userId` jawnie w SQL — RPC sam tego nie robi (zakłada RLS),
 * a my jedziemy przez `supabaseAdmin` (RLS bypass), więc bez tego filtra
 * narzędzie zwracałoby plany wszystkich userów (data leak).
 *
 * Strategia bez LATERAL: pierwsze zapytanie zwraca timetable entries dla
 * usera w zakresie (max 50). Drugie zapytanie pobiera świeże ogłoszenia
 * cancelled (z ostatnich 168h) per `lecturer_key` z PIERWSZEGO zapytania
 * (`in('lecturer_key', ...)`). Merge w pamięci — dla < 50 entries to
 * tańsze niż LATERAL.
 *
 * Auth: WYMAGANE. Anon → krótki komunikat o logowaniu.
 *
 * Cache: 60s (zajęcia statyczne, ogłoszenia odświeżane scraperem ~co kilka
 * minut — 60s daje dobrą świeżość bez floodu).
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 50
const ANNOUNCEMENT_WINDOW_HOURS = 168 // 7 dni — domyślne okno z RPC

const NOT_LOGGED_IN_MESSAGE =
  'Aby zobaczyć Twój plan zajęć musisz być zalogowany w UJverse.'

const TimetableRowSchema = z.object({
  id: z.union([z.number(), z.string()]),
  uid: z.string().nullable(),
  summary: z.string(),
  lecturer_name: z.string().nullable(),
  lecturer_key: z.string().nullable(),
  location: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
})
const TimetableRowsSchema = z.array(TimetableRowSchema)

const AnnouncementRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  status: z.string(),
  created_at: z.string(),
  lecturer_name: z.string().nullable(),
  lecturer_key: z.string().nullable(),
})
const AnnouncementRowsSchema = z.array(AnnouncementRowSchema)

export type GetMyClassesInRangeArgs = {
  range_start: string
  range_end: string
}

type ResultItem = {
  id: string
  summary: string
  lecturer_name: string | null
  location: string | null
  start_time: string
  end_time: string
  cancelled_announcement_id: string | null
  cancelled_announcement_body: string | null
  cancelled_announcement_at: string | null
}

export type GetMyClassesInRangeResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type GetMyClassesInRangeError = {
  ok: false
  error: string
}

function validateRange(
  start: string,
  end: string,
): { ok: true } | { ok: false; error: string } {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime())) {
    return { ok: false, error: 'invalid range_start (expected ISO 8601)' }
  }
  if (Number.isNaN(e.getTime())) {
    return { ok: false, error: 'invalid range_end (expected ISO 8601)' }
  }
  if (s.getTime() > e.getTime()) {
    return { ok: false, error: 'range_start must be <= range_end' }
  }
  const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
  if (days > 31) {
    return { ok: false, error: 'range too large (max 31 days)' }
  }
  return { ok: true }
}

async function execute(
  args: GetMyClassesInRangeArgs,
  ctx: ToolContext,
): Promise<GetMyClassesInRangeResult | GetMyClassesInRangeError | string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  if (typeof args.range_start !== 'string' || typeof args.range_end !== 'string') {
    return { ok: false, error: 'range_start and range_end are required' }
  }

  const validation = validateRange(args.range_start, args.range_end)
  if (validation.ok === false) {
    return { ok: false, error: validation.error }
  }

  const { data: entriesData, error: entriesErr } = await ctx.supabaseAdmin
    .from('user_timetable_entries')
    .select(
      'id, uid, summary, lecturer_name, lecturer_key, location, start_time, end_time',
    )
    .eq('user_id', ctx.userId)
    .gte('start_time', args.range_start)
    .lte('start_time', args.range_end)
    .order('start_time', { ascending: true })
    .limit(MAX_ROWS)

  if (entriesErr) {
    console.error('[get_my_classes_in_range] entries error:', entriesErr.message)
    return { ok: false, error: entriesErr.message }
  }
  const entriesParsed = TimetableRowsSchema.safeParse(entriesData ?? [])
  if (!entriesParsed.success) {
    console.error(
      '[get_my_classes_in_range] zod validation failed (entries):',
      entriesParsed.error.issues,
    )
    return { ok: false, error: 'invalid timetable row shape from database' }
  }
  const entries = entriesParsed.data
  if (entries.length === 0) {
    return 'Brak zajęć w tym zakresie'
  }

  // Drugi krok: dociągnij świeże ogłoszenia cancelled per lecturer_key.
  const lecturerKeys = Array.from(
    new Set(
      entries
        .map((e) => e.lecturer_key)
        .filter((k): k is string => typeof k === 'string' && k.length > 0),
    ),
  )

  const announcementsByKey = new Map<
    string,
    { id: string; body: string; created_at: string }
  >()

  if (lecturerKeys.length > 0) {
    const cutoff = new Date(
      Date.now() - ANNOUNCEMENT_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString()
    const { data: annData, error: annErr } = await ctx.supabaseAdmin
      .from('announcements')
      .select('id, body, status, created_at, lecturer_name, lecturer_key')
      .eq('status', 'cancelled')
      .in('lecturer_key', lecturerKeys)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })

    if (annErr) {
      console.warn(
        '[get_my_classes_in_range] announcements lookup failed:',
        annErr.message,
      )
    } else {
      const annParsed = AnnouncementRowsSchema.safeParse(annData ?? [])
      if (annParsed.success) {
        // Najnowsze pierwsze (sort z DB), pierwszy dla danego klucza wygrywa.
        for (const a of annParsed.data) {
          if (!a.lecturer_key) continue
          if (!announcementsByKey.has(a.lecturer_key)) {
            announcementsByKey.set(a.lecturer_key, {
              id: a.id,
              body: a.body,
              created_at: a.created_at,
            })
          }
        }
      }
    }
  }

  const items: ResultItem[] = entries.map((e) => {
    const cancelled = e.lecturer_key
      ? announcementsByKey.get(e.lecturer_key)
      : undefined
    return {
      id: String(e.id),
      summary: e.summary,
      lecturer_name: e.lecturer_name,
      location: e.location,
      start_time: e.start_time,
      end_time: e.end_time,
      cancelled_announcement_id: cancelled?.id ?? null,
      cancelled_announcement_body: cancelled?.body ?? null,
      cancelled_announcement_at: cancelled?.created_at ?? null,
    }
  })

  return { ok: true, count: items.length, items }
}

registerTool<
  GetMyClassesInRangeArgs,
  GetMyClassesInRangeResult | GetMyClassesInRangeError | string
>({
  tool: {
    name: 'get_my_classes_in_range',
    description:
      'Plan zajęć usera (z USOSweb) w zakresie, z flagą „odwołane" gdy match z komunikatem. Dla „co mam dziś/jutro/w tym tygodniu". Auth wymagany. Max 31 dni.',
    parameters: {
      type: 'object',
      properties: {
        range_start: { type: 'string', description: 'ISO 8601.' },
        range_end: { type: 'string', description: 'ISO 8601, max 31 dni.' },
      },
      required: ['range_start', 'range_end'],
      additionalProperties: false,
    },
  },
  execute,
})
