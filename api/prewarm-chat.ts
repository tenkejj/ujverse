/**
 * `/api/prewarm-chat` — warmuje response cache dla popularnych zapytań.
 *
 * Cron: na planie Hobby Vercel tylko 1×/dzień — nie dodawaj `*/N * * * *`.
 * Po deployu odpal ręcznie: `npm run chat:prewarm` (albo curl z CRON_SECRET).
 */

import {
  buildResponseCacheKey,
  formatToolResultForCache,
  RESPONSE_CACHE_FAST_PATH_TTL_SECONDS,
} from './_lib/chatResponseCache.js'
import { tryFastPath } from './_lib/fastPath.js'
import { kvSetSafe } from './_lib/kvCache.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getToolEntry, type ToolContext } from './_lib/tools/index.js'

export const config = { runtime: 'nodejs' }

/** Sync z `src/lib/chatQuickPrompts.ts` + slash queries z fast-path. */
const PREWARM_QUERIES: readonly string[] = [
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Co mam dziś w planie?',
  'Co mam jutro?',
  'Pokaż zniżki studenckie',
  'Co w Auli?',
  'Moje powiadomienia',
  'Co przegapiłem?',
  'Co w przyszłym tygodniu?',
  'Wydarzenia naukowe',
  'Jakie zniżki są teraz najpopularniejsze?',
  'Pokaż mój briefing tygodniowy',
  'Jakie są nadchodzące rejestracje USOS?',
  'Kiedy są juwenalia UJ?',
  'Moi wykładowcy',
] as const

type PrewarmResult = {
  query: string
  status: 'ok' | 'skipped' | 'error'
  reason?: string
  contentLen?: number
}

async function prewarmOne(
  query: string,
  ctx: ToolContext,
): Promise<PrewarmResult> {
  const fast = tryFastPath(query)
  if (!fast) {
    return { query, status: 'skipped', reason: 'no fast-path match' }
  }
  const entry = getToolEntry(fast.toolName)
  if (!entry) {
    return { query, status: 'skipped', reason: `unknown tool: ${fast.toolName}` }
  }

  try {
    const result = await entry.execute(fast.args, ctx)
    const formatted = formatToolResultForCache(fast.toolName, result, query)
    if (!formatted) {
      return { query, status: 'skipped', reason: 'empty formatted result' }
    }
    const cacheKey = buildResponseCacheKey(query, true, ctx.userId)
    await kvSetSafe(cacheKey, formatted, RESPONSE_CACHE_FAST_PATH_TTL_SECONDS)
    return { query, status: 'ok', contentLen: formatted.length }
  } catch (err) {
    return {
      query,
      status: 'error',
      reason: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.CRON_SECRET
    const auth = req.headers.get('authorization') ?? ''
    if (!expected || auth !== `Bearer ${expected}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const ctx: ToolContext = {
    userId: null,
    supabaseAdmin: getSupabaseAdmin(),
  }

  const results: PrewarmResult[] = []
  const seen = new Set<string>()
  for (const q of PREWARM_QUERIES) {
    const key = q.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const r = await prewarmOne(q, ctx)
    results.push(r)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  console.log('[prewarm-chat] done', { ok, skipped, errors })

  return new Response(
    JSON.stringify({
      ok: true,
      summary: { total: results.length, ok, skipped, errors },
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
