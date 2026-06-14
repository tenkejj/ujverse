/**
 * Tool: `get_lecturer_announcements_by_name`
 *
 * Zwraca najświeższe komunikaty (cancelled / remote / duty) dla
 * wykładowcy podanego z imienia/nazwiska. Strategia dwuetapowa:
 *
 *   1. `search_lecturers(query, 1)` → znajdź kanoniczną formę i `lecturer_key`
 *      (znormalizowany, deduplikowany). To jeden RPC call.
 *   2. `announcements_for_lecturer_keys([key], 6)` → pobierz najnowsze
 *      6 komunikatów po kluczu. Drugi RPC call.
 *
 * Dwa RPC zamiast jednego JOINu — cena drobnego latency, ale obie funkcje
 * już istnieją (z migracji 20260615100000_lecturer_subscriptions.sql) i
 * dają precyzyjny matching (klucz po `lecturer_name_key` immutable funkcji,
 * bez fallszywych pozytywów typu „Jan Kowalski" vs „dr Jan Adam Kowalski").
 *
 * Trigger user-side:
 *   - „co napisał Kowalski"
 *   - „ogłoszenia od dr X"
 *   - „pokaż wszystkie wpisy [nazwisko]"
 *
 * Cache TTL: 60s — krótkie, bo to pierwsze źródło info o nieobecnościach.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 6
const MIN_QUERY_LEN = 2

const SearchRpcRowSchema = z.object({
  lecturer_name: z.string(),
  lecturer_key: z.string(),
  announcement_count: z.union([z.number(), z.string()]),
  latest_at: z.string().nullable(),
})
const SearchRpcRowsSchema = z.array(SearchRpcRowSchema)

const AnnouncementRowSchema = z.object({
  id: z.string(),
  lecturer_name: z.string(),
  body: z.string(),
  status: z.string(),
  department: z.string().nullable(),
  created_at: z.string(),
})
const AnnouncementRowsSchema = z.array(AnnouncementRowSchema)

export type GetLecturerAnnouncementsArgs = { lecturer_name: string }

type ResultItem = {
  id: string
  lecturer_name_nominative: string
  body: string
  status: string
  department: string | null
  created_at: string
}

export type GetLecturerAnnouncementsResult =
  | { ok: true; lecturer_name: string; count: number; items: ResultItem[] }
  | { ok: false; error: string }
  | string

async function execute(
  args: GetLecturerAnnouncementsArgs,
  ctx: ToolContext,
): Promise<GetLecturerAnnouncementsResult> {
  const query =
    typeof args?.lecturer_name === 'string' ? args.lecturer_name.trim() : ''
  if (query.length < MIN_QUERY_LEN) {
    return {
      ok: false,
      error: `Min. ${MIN_QUERY_LEN} znaki, dostałem: "${query}".`,
    }
  }

  // Krok 1: znajdź kanoniczny klucz wykładowcy.
  const lookup = await ctx.supabaseAdmin.rpc('search_lecturers', {
    p_query: query,
    p_limit: 1,
  })

  if (lookup.error) {
    console.error('[get_lecturer_announcements] search error:', lookup.error.message)
    return { ok: false, error: lookup.error.message }
  }

  const matches = SearchRpcRowsSchema.safeParse(lookup.data ?? [])
  if (!matches.success || matches.data.length === 0) {
    return `Nikogo o nazwisku „${query}" nie znalazłem w bazie ogłoszeń. Może literówka?`
  }

  const top = matches.data[0]

  // Krok 2: pobierz najświeższe komunikaty po kluczu.
  const annsRes = await ctx.supabaseAdmin.rpc('announcements_for_lecturer_keys', {
    p_keys: [top.lecturer_key],
    p_limit: MAX_ROWS,
  })

  if (annsRes.error) {
    console.error('[get_lecturer_announcements] anns error:', annsRes.error.message)
    return { ok: false, error: annsRes.error.message }
  }

  const parsed = AnnouncementRowsSchema.safeParse(annsRes.data ?? [])
  if (!parsed.success) {
    console.error(
      '[get_lecturer_announcements] zod parse failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid announcement row shape' }
  }

  if (parsed.data.length === 0) {
    return `**${top.lecturer_name}** — w bazie znaleziony, ale brak ogłoszeń. Spokojny wykładowca.`
  }

  const items: ResultItem[] = parsed.data.map((r) => ({
    id: r.id,
    lecturer_name_nominative: r.lecturer_name,
    body: r.body,
    status: r.status,
    department: r.department,
    created_at: r.created_at,
  }))

  return {
    ok: true,
    lecturer_name: top.lecturer_name,
    count: items.length,
    items,
  }
}

registerTool<GetLecturerAnnouncementsArgs, GetLecturerAnnouncementsResult>({
  tool: {
    name: 'get_lecturer_announcements_by_name',
    description:
      'Najświeższe komunikaty od wykładowcy o podanym nazwisku (cancelled/remote/duty). Dla „co napisał Kowalski", „ogłoszenia od dr X".',
    parameters: {
      type: 'object',
      properties: {
        lecturer_name: {
          type: 'string',
          description: 'Fragment nazwiska, min. 2 znaki.',
        },
      },
      required: ['lecturer_name'],
      additionalProperties: false,
    },
  },
  execute,
})
