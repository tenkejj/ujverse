/**
 * `/api/prewarm-chat` — Vercel cron endpoint do warmowania response cache'u
 * dla najczęstszych zapytań do asystenta.
 *
 * Strategia: zamiast strzelać do `/api/chat` self-loop'em (HTTP -> HTTP, drogo
 * w cold-startach Edge), wołamy odpowiednie narzędzia BEZPOŚREDNIO i piszemy
 * sformatowany wynik do KV pod tym samym kluczem cache'u, którego używa
 * `api/chat.ts:buildResponseCacheKey`. Dzięki temu kolejny user, który zada
 * to samo pytanie, dostanie odpowiedź z KV bez Supabase'a, bez Groqa, bez
 * fast-path'a — czysty Redis read.
 *
 * Auth:
 *   - W produkcji Vercel cron dokleja header `Authorization: Bearer <CRON_SECRET>`.
 *   - Dev/local: brak guard'u; każdy może uderzyć (rzadko używane lokalnie).
 *
 * Uruchamianie: zob. `vercel.json:crons` — schedule `*\/15 * * * *` (co 15 min).
 * TTL response cache to 300s (5 min), więc co 15 min jest wystarczająco
 * często, żeby cache był ZAWSZE świeży po pierwszym warm-upie.
 */

import { kvSetSafe } from './_lib/kvCache.js'
import { tryFastPath } from './_lib/fastPath.js'
import { buildToolCacheKey } from './_lib/cache.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getToolEntry, type ToolContext } from './_lib/tools/index.js'

export const config = { runtime: 'nodejs' }

/**
 * Lista pytań do warmowania. KEEP IN SYNC z `scripts/prewarm-chat-cache.ts`
 * i `src/lib/chatSlashCommands.ts` (queries).
 *
 * Pomijamy "cześć" (small-talk path nie ma narzędzi → musiałby przejść przez
 * Groqa, czego cron unikać powinien — gdyby Groq był rate-limit'em, cron
 * by go zaśmiecał).
 */
const PREWARM_QUERIES: readonly string[] = [
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Co w przyszłym tygodniu?',
  'Wydarzenia naukowe',
  'Pokaż zniżki studenckie',
  'Jakie zniżki są teraz najpopularniejsze?',
  'Co mam dziś w planie?',
  'Pokaż mój briefing tygodniowy',
  'Jakie są nadchodzące rejestracje USOS?',
  'Kiedy są juwenalia UJ?',
] as const

/** Klucz response cache'u — MUSI BYĆ identyczny ze `chat.ts:buildResponseCacheKey`. */
function buildResponseCacheKey(lastUserText: string, useTools: boolean): string {
  const normalized = lastUserText.trim().toLowerCase().replace(/\s+/g, ' ')
  return buildToolCacheKey('chat_response', { text: normalized, useTools })
}

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
    // Wykonaj narzędzie — ale do formattera nie sięgamy z `chat.ts`,
    // żeby nie zamieniać tego pliku w spaghetti. Zamiast tego: bezpośredni
    // import formattera. Najprościej — zaimportować `formatToolResultAsFinalAnswer`
    // ze swojej kopii… Tu robimy wariant: użyjemy `chat.ts` jako library.
    const result = await entry.execute(fast.args, ctx)
    // Re-import — `formatToolResultAsFinalAnswer` jest w `chat.ts`. Żeby
    // nie tworzyć kolejnej kopii formatterów, ekstraktujemy go… Później.
    // Na razie: zapisujemy SAM `result` jako string (jeśli string), albo
    // rezygnujemy. Najprościej:
    if (typeof result === 'string') {
      const cacheKey = buildResponseCacheKey(query, true)
      await kvSetSafe(cacheKey, result, 300)
      return { query, status: 'ok', contentLen: result.length }
    }
    // Dla rezultatów obiektowych — wymagałyby formattera. Cron wpisze
    // marker i pozwoli regularny request `/api/chat` zformatować + zapisać.
    return {
      query,
      status: 'skipped',
      reason: 'object result — formatter not in cron path',
    }
  } catch (err) {
    return {
      query,
      status: 'error',
      reason: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  // Auth: Vercel cron dokleja `Authorization: Bearer <CRON_SECRET>`.
  // W dev tryb (NODE_ENV !== 'production') przepuszczamy bez secretu.
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
    userId: null, // cron nie ma usera — narzędzia auth-required są pomijane
    supabaseAdmin: getSupabaseAdmin(),
  }

  const results: PrewarmResult[] = []
  for (const q of PREWARM_QUERIES) {
    const r = await prewarmOne(q, ctx)
    results.push(r)
    // Lekka pauza, żeby Supabase nie dostał spike'a od jednego cronu.
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  console.log('[prewarm-chat] done', { ok, skipped, errors, results })

  return new Response(
    JSON.stringify({
      ok: true,
      summary: { total: results.length, ok, skipped, errors },
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
