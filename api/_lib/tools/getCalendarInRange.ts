/**
 * Tool: `get_calendar_in_range`
 *
 * Zwraca wpisy kalendarza akademickiego w podanym zakresie dat z RPC
 * `public.calendar_search` (migracja 20260621100000_calendar_entries).
 *
 * Argumenty:
 *   - `range_start`, `range_end` w ISO 8601 (timestamptz). Akceptujemy
 *     formaty z 'Z', offsetem lub bez — Postgres `timestamptz` znormalizuje.
 *   - opcjonalnie `kinds[]` (filter po typie), `lecturer_keys[]`
 *     (filter po znormalizowanych kluczach wykładowców), `departments[]`.
 *
 * Strategia:
 *   - RPC robi heavy lifting (GIST index `time_range &&`), my tylko
 *     normalizujemy daty i przepuszczamy filtry.
 *   - Zwracamy maks. `MAX_ROWS` wpisów; jeśli model potrzebuje więcej,
 *     niech zaweź zakres albo użyje filtra `kinds`.
 *   - Pusta tablica wyników → `EMPTY_RESULT_MESSAGE` (literalny string,
 *     z którym Llama radzi sobie lepiej niż z pustym JSON-em).
 *
 * Cache: standardowo przez `ttlForTool` (60s default w `cache.ts` — gdy
 * scraper coś dorzuci, kalendarz przez chwilę pokazuje stare dane przez
 * narzędzie, ale to OK w kontekście rozmowy z modelem).
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 50

const EMPTY_RESULT_MESSAGE = 'Brak wpisów w kalendarzu dla tego zakresu'

const ALLOWED_KINDS = [
  'lecturer_absence',
  'class_cancelled',
  'class_remote',
  'class_rescheduled',
  'duty_change',
  'free_day',
  'official_event',
  'community_event',
  'deadline',
] as const

const CalendarEntryRowSchema = z.object({
  id: z.string(),
  kind: z.enum(ALLOWED_KINDS),
  title: z.string(),
  description: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  all_day: z.boolean(),
  lecturer_name: z.string().nullable(),
  location: z.string().nullable(),
  department: z.string().nullable(),
})

const CalendarEntryRowsSchema = z.array(CalendarEntryRowSchema)

/**
 * Argumenty narzędzia widziane przez model. Świadomie BEZ filtrów po
 * `kinds`/`lecturer_keys`/`departments` — `ToolJsonSchema` z `registry.ts`
 * wspiera tylko proste typy (string/number/bool). Array params wymagałyby
 * rozszerzenia schematu rejestracji, czego w v1 nie robimy. Model dostaje
 * pełen widok zakresu i sam wybiera istotne wpisy w odpowiedzi.
 */
export type GetCalendarInRangeArgs = {
  range_start: string
  range_end: string
}

type ResultItem = {
  id: string
  kind: (typeof ALLOWED_KINDS)[number]
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  lecturer_name: string | null
  location: string | null
  department: string | null
}

export type GetCalendarInRangeResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type GetCalendarInRangeError = {
  ok: false
  error: string
}

/** Strażnik: range_start <= range_end, oba parsowalne. */
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
  // Bezpiecznik: nie pozwól na zakres > 18 miesięcy (model mógłby zażądać
  // "całego roku akademickiego" → DB cap-uje do 2000 wierszy, my do 50,
  // ale token cost gdyby zwrócił dużo).
  const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
  if (days > 550) {
    return { ok: false, error: 'range too large (max ~18 months)' }
  }
  return { ok: true }
}

async function execute(
  args: GetCalendarInRangeArgs,
  ctx: ToolContext,
): Promise<GetCalendarInRangeResult | GetCalendarInRangeError | string> {
  if (typeof args.range_start !== 'string' || typeof args.range_end !== 'string') {
    return { ok: false, error: 'range_start and range_end are required' }
  }

  const validation = validateRange(args.range_start, args.range_end)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }

  const { data, error } = await ctx.supabaseAdmin.rpc('calendar_search', {
    p_range_start: args.range_start,
    p_range_end: args.range_end,
    p_kinds: null,
    p_lecturer_keys: null,
    p_departments: null,
    p_limit: MAX_ROWS,
  })

  if (error) {
    console.error('[get_calendar_in_range] RPC error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = CalendarEntryRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[get_calendar_in_range] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid calendar entry shape from database' }
  }

  if (parsed.data.length === 0) {
    return EMPTY_RESULT_MESSAGE
  }

  return {
    ok: true,
    count: parsed.data.length,
    items: parsed.data,
  }
}

registerTool<
  GetCalendarInRangeArgs,
  GetCalendarInRangeResult | GetCalendarInRangeError | string
>({
  tool: {
    name: 'get_calendar_in_range',
    description:
      'Pobiera wpisy kalendarza akademickiego (nieobecności wykładowców, ' +
      'odwołane zajęcia, zajęcia zdalne, przeniesienia terminów, dyżury ' +
      'oraz oficjalne wydarzenia UJ) z podanego zakresu dat. Każdy wpis ma ' +
      'kind, tytuł, daty, lokalizację, wykładowcę. ZAWSZE używaj tego ' +
      'narzędzia gdy użytkownik pyta: „co jest w przyszłym tygodniu", „czy ' +
      'dr X będzie w piątek", „kiedy odwołane zajęcia", „pokaż dni wolne". ' +
      'Range podawaj w pełnym ISO 8601 (np. „2026-06-12T00:00:00Z").',
    parameters: {
      type: 'object',
      properties: {
        range_start: {
          type: 'string',
          description:
            'Początek zakresu (ISO 8601 z czasem, np. „2026-06-15T00:00:00Z").',
        },
        range_end: {
          type: 'string',
          description:
            'Koniec zakresu (ISO 8601 z czasem, np. „2026-06-22T23:59:59Z"). Max ~18 miesięcy od range_start.',
        },
      },
      required: ['range_start', 'range_end'],
      additionalProperties: false,
    },
  },
  execute,
})
