/**
 * Tool: `get_latest_posts`
 *
 * Zwraca 10 najnowszych postów z `public.posts` z dołączonym profilem autora.
 *
 * Schemat (live, zweryfikowany przez `lib/searchSyncMapper.ts:31-38` —
 * `PostRecord = { id, content?, tags?, user_id?, created_at? }`):
 *
 *   posts:
 *     id           BIGSERIAL
 *     user_id      UUID -> profiles(id)
 *     content      TEXT          <- treść posta (NIE `body`; `body` z bootstrap
 *                                   migracji zostało zastąpione `content`,
 *                                   patrz `PostsAdapter.ts:37` i skrypty)
 *     tags         TEXT[]        <- z migracji `20260527120000_posts_tags.sql`
 *     created_at   TIMESTAMPTZ
 *
 * `department` NIE jest kolumną `posts` używaną w runtime — schemat trzyma ją
 * tylko na `profiles`. Dlatego wybieramy `profiles.department`, a top-level
 * kolumny ograniczamy do tego, co faktycznie istnieje i jest spójne z
 * `searchSyncMapper.PostRecord`.
 *
 * Defensive: na wynik z PostgREST aplikujemy `JSON.parse(JSON.stringify(...))`
 * żeby (a) odciąć ewentualne nieserializowalne wartości (Date, BigInt — Edge
 * runtime ma BigInt, a Postgres BIGSERIAL może w niektórych konfiguracjach
 * trafić tu jako BigInt mimo `select`), (b) zagwarantować że `JSON.stringify`
 * w orchestratorze (przy budowaniu `tool` message) nie wybuchnie.
 */

import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10
const MAX_BODY_CHARS = 600

type PostRow = {
  id: number | string
  content: string | null
  tags: string[] | null
  created_at: string | null
  user_id: string | null
  profiles:
    | {
        id: string | null
        full_name: string | null
        username: string | null
        department: string | null
      }
    | Array<{
        id: string | null
        full_name: string | null
        username: string | null
        department: string | null
      }>
    | null
}

export type GetLatestPostsResult = {
  ok: true
  count: number
  items: Array<{
    id: string
    body: string
    tags: string[]
    department: string | null
    created_at: string | null
    author: {
      full_name: string | null
      username: string | null
      department: string | null
    } | null
  }>
}

export type GetLatestPostsError = {
  ok: false
  error: string
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function normalizeProfile(
  raw: PostRow['profiles'],
): GetLatestPostsResult['items'][number]['author'] {
  if (!raw) return null
  const candidate = Array.isArray(raw) ? raw[0] : raw
  if (!candidate) return null
  return {
    full_name: candidate.full_name ?? null,
    username: candidate.username ?? null,
    department: candidate.department ?? null,
  }
}

/**
 * Deep clone via `JSON.parse(JSON.stringify(...))`. Zabezpiecza się przed
 * błędem serializacji w orchestratorze (`api/chat.ts` robi `JSON.stringify`
 * na całym wyniku przy budowaniu `tool` message). Każda ukryta wartość
 * nieserializowalna (np. cykliczna referencja, BigInt) zostaje wyeliminowana
 * tutaj, przy granicy modułu.
 */
function deepCloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<GetLatestPostsResult | GetLatestPostsError> {
  const { data, error } = await ctx.supabaseAdmin
    .from('posts')
    .select(
      'id, content, tags, created_at, user_id, ' +
        'profiles(id, full_name, username, department)',
    )
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    console.error('[get_latest_posts] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const safeData = deepCloneSerializable((data ?? []) as unknown as PostRow[])
  const items = safeData.map((r) => {
    const tags = Array.isArray(r.tags)
      ? r.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : []
    const author = normalizeProfile(r.profiles)
    return {
      id: String(r.id),
      body: truncate(r.content ?? '', MAX_BODY_CHARS),
      tags,
      department: author?.department ?? null,
      created_at: r.created_at,
      author,
    }
  })

  return { ok: true, count: items.length, items }
}

registerTool<Record<string, never>, GetLatestPostsResult | GetLatestPostsError>({
  tool: {
    name: 'get_latest_posts',
    description:
      '10 najnowszych postów społeczności UJverse. Dla pytań „co na feedzie", „dyskusje", „nastroje".',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
