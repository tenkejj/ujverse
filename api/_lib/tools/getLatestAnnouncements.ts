/**
 * Tool: `get_latest_announcements`
 *
 * Zwraca 10 najnowszych komunikatów z `public.announcements` wzbogaconych
 * o mianownik nazwiska (z `public.lecturer_names_cache`, jeśli istnieje wpis).
 *
 * Dlaczego dwie kwerendy zamiast PostgREST embeddingu:
 *   `announcements.lecturer_name` -> `lecturer_names_cache.original_name`
 *   to NIE jest FK (różne typy semantyczne, brak constraintu w migracjach
 *   `20260412120000_announcements.sql` / `20260415120000_lecturer_names_cache.sql`).
 *   PostgREST embedding wymaga FK lub computed FK — żadnego nie mamy. Stąd
 *   `select(announcements)` + `in('original_name', uniqueLecturerNames)` na
 *   cache i merge w pamięci.
 *
 * Format wyjściowy zwięzły (`id`, `lecturer_name_nominative`, `body`, `status`,
 * `department`, `source`, `created_at`) — model konsumuje to jako kontekst,
 * nie surowy JSON do prezentacji UI. Zbyt wiele pól = niepotrzebne tokeny.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10

/**
 * Komunikat zwracany do modelu gdy zapytanie nie znalazło wyników. Format
 * surowego string-a (zamiast pustego `{ ok: true, items: [] }`) świadomy —
 * model llama-3.1-8b-instant lepiej radzi sobie z literalnym tekstem przy
 * syntezie odpowiedzi "brak danych" niż z pustą tablicą JSON.
 */
const EMPTY_RESULT_MESSAGE = 'Brak danych w bazie dla tego zapytania'

/**
 * Zod schema dla wiersza `announcements` zwracanego przez Supabase. Pełni
 * rolę runtime "return type check" — jeśli schemat tabeli się rozjedzie albo
 * Postgres zwróci nieoczekiwane typy, `safeParse` to wyłapie i nie pozwoli
 * wpuścić śmieci do wyniku narzędzia. Status musi być jedną z trzech wartości
 * domeny (`cancelled` | `remote` | `duty`).
 */
const AnnouncementRowSchema = z.object({
  id: z.string(),
  lecturer_name: z.string(),
  body: z.string(),
  status: z.enum(['cancelled', 'remote', 'duty']),
  department: z.string().nullable(),
  source: z.string().nullable(),
  source_url: z.string().nullable(),
  created_at: z.string(),
})

const AnnouncementRowsSchema = z.array(AnnouncementRowSchema)

type AnnouncementRow = z.infer<typeof AnnouncementRowSchema>

type LecturerCacheRow = {
  original_name: string
  nominative_name: string
}

export type GetLatestAnnouncementsResult = {
  ok: true
  count: number
  items: Array<{
    id: string
    lecturer_name_nominative: string
    body: string
    status: AnnouncementRow['status']
    department: string | null
    source: string | null
    source_url: string | null
    created_at: string
  }>
}

export type GetLatestAnnouncementsError = {
  ok: false
  error: string
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<GetLatestAnnouncementsResult | GetLatestAnnouncementsError | string> {
  const { data, error } = await ctx.supabaseAdmin
    .from('announcements')
    .select('id, lecturer_name, body, status, department, source, source_url, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    console.error('[get_latest_announcements] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = AnnouncementRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[get_latest_announcements] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid announcements row shape from database' }
  }

  const rows: AnnouncementRow[] = parsed.data
  if (rows.length === 0) {
    return EMPTY_RESULT_MESSAGE
  }

  const uniqueNames = Array.from(
    new Set(rows.map((r) => r.lecturer_name).filter((n) => n && n.length > 0)),
  )

  let cacheMap = new Map<string, string>()
  if (uniqueNames.length > 0) {
    const { data: cacheRows, error: cacheErr } = await ctx.supabaseAdmin
      .from('lecturer_names_cache')
      .select('original_name, nominative_name')
      .in('original_name', uniqueNames)

    if (cacheErr) {
      console.warn(
        '[get_latest_announcements] lecturer_names_cache lookup failed:',
        cacheErr.message,
      )
    } else if (cacheRows) {
      cacheMap = new Map(
        (cacheRows as LecturerCacheRow[]).map((r) => [r.original_name, r.nominative_name]),
      )
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    lecturer_name_nominative: cacheMap.get(r.lecturer_name) ?? r.lecturer_name,
    body: r.body,
    status: r.status,
    department: r.department,
    source: r.source,
    source_url: r.source_url,
    created_at: r.created_at,
  }))

  return { ok: true, count: items.length, items }
}

registerTool<
  Record<string, never>,
  GetLatestAnnouncementsResult | GetLatestAnnouncementsError | string
>({
  tool: {
    name: 'get_latest_announcements',
    description:
      '10 najnowszych komunikatów ISI UJ (odwołane zajęcia, dyżury, zdalne). Pytania o ogłoszenia/komunikaty/odwołane.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
