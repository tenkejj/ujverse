/**
 * Tool: `find_lecturer`
 *
 * Autocomplete po wykładowcach UJ. Dane czerpiemy z `public.announcements`
 * (jedyne źródło nazwisk in-app). Używamy RPC `search_lecturers` z migracji
 * `20260615100000_lecturer_subscriptions.sql` — RPC sam dedupliuje per
 * `lecturer_key` (znormalizowane: lower + bez diakrytyków + bez tytułów),
 * a jako display wybiera najdłuższą znaną formę (typowo z tytułem).
 *
 * Trigger user-side:
 *   - „kontakt do dr X", „kto to dr X", „pokaż dr X"
 *   - bardziej liberalne niż `find_user` (który szuka studentów po profilach)
 *
 * Cache TTL: 300s — lecturer set zmienia się rzadko.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 6
const MIN_QUERY_LEN = 2

const RpcRowSchema = z.object({
  lecturer_name: z.string(),
  lecturer_key: z.string(),
  announcement_count: z.union([z.number(), z.string()]),
  latest_at: z.string().nullable(),
})
const RpcRowsSchema = z.array(RpcRowSchema)

export type FindLecturerArgs = { query: string }
type ResultItem = {
  lecturer_name: string
  lecturer_key: string
  announcement_count: number
  latest_at: string | null
}
export type FindLecturerResult =
  | { ok: true; count: number; items: ResultItem[] }
  | { ok: false; error: string }
  | string

async function execute(
  args: FindLecturerArgs,
  ctx: ToolContext,
): Promise<FindLecturerResult> {
  const query = typeof args?.query === 'string' ? args.query.trim() : ''
  if (query.length < MIN_QUERY_LEN) {
    return {
      ok: false,
      error: `Min. ${MIN_QUERY_LEN} znaki, dostałem: "${query}".`,
    }
  }

  const { data, error } = await ctx.supabaseAdmin.rpc('search_lecturers', {
    p_query: query,
    p_limit: MAX_ROWS,
  })

  if (error) {
    console.error('[find_lecturer] rpc error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = RpcRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[find_lecturer] zod parse failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid lecturer row shape' }
  }

  if (parsed.data.length === 0) {
    return `Nikogo o nazwisku „${query}" nie znalazłem w bazie ogłoszeń. Może spróbuj innego nazwiska?`
  }

  const items: ResultItem[] = parsed.data.map((r) => ({
    lecturer_name: r.lecturer_name,
    lecturer_key: r.lecturer_key,
    announcement_count:
      typeof r.announcement_count === 'number'
        ? r.announcement_count
        : Number(r.announcement_count),
    latest_at: r.latest_at,
  }))

  return { ok: true, count: items.length, items }
}

registerTool<FindLecturerArgs, FindLecturerResult>({
  tool: {
    name: 'find_lecturer',
    description:
      'Szuka wykładowcy UJ po fragmencie nazwiska. Dla „kto to dr X", „znajdź dr Y", „pokaż wykładowcę". Min. 2 znaki.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fragment nazwiska, min. 2 znaki.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  execute,
})
