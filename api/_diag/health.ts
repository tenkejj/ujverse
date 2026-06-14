/**
 * `/api/_diag/health` — endpoint do monitoringu (UptimeRobot, Better Stack,
 * własny dashboard). Sprawdza że trzy upstream zależności żyją:
 *
 *   1. Supabase     — szybki SELECT 1 z `profiles` (RLS-safe via service role).
 *   2. Vercel KV    — `kv.set` + `kv.get` na unikalnym kluczu (TTL 5s).
 *   3. Groq         — `OPTIONS /v1/chat/completions` (zero kosztu, zero LLM
 *                     calli, sprawdza tylko czy DNS+TLS+credentials żyją).
 *
 * Token-gated tak samo jak `/api/_diag/cache-stats` — `Authorization: Bearer
 * $DIAG_TOKEN` lub `?token=...`. W dev (`NODE_ENV !== 'production'`)
 * endpoint jest otwarty, z warn'em do logu.
 *
 * Response shape:
 * {
 *   "overall": "ok" | "degraded" | "down",
 *   "ts": "2026-06-14T21:00:00.000Z",
 *   "checks": {
 *     "supabase": { "ok": true,  "latencyMs": 47 },
 *     "kv":       { "ok": true,  "latencyMs": 12 },
 *     "groq":     { "ok": true,  "latencyMs": 230 }
 *   },
 *   "circuitBreaker": { "state": "CLOSED", ... }
 * }
 *
 * `overall`:
 *   - `ok`        — wszystkie trzy `ok: true`
 *   - `degraded`  — Groq down LUB CB OPEN, ale Supabase + KV żyją
 *                   (chatbot serwuje friendly fallback, app działa)
 *   - `down`      — Supabase ALBO KV padło — brak fallbacku, problem krytyczny
 *
 * HTTP status: 200 dla `ok`/`degraded`, 503 dla `down` — UptimeRobot uderzy
 * alarm tylko przy `down`. Degradacje monitoring widzi w body, ale nie
 * spamują na PagerDuty.
 */
import { kv } from '@vercel/kv'
import { getStatus as getCircuitStatus } from '../_lib/groqCircuitBreaker.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export const config = { runtime: 'nodejs' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

/**
 * Per-check timeout. Health endpoint MA się odpalić szybko (UptimeRobot
 * tnie po 30s, my chcemy <2s typowo). Każdy upstream ma własny budżet.
 */
const CHECK_TIMEOUT_MS = 3000

type CheckResult = {
  ok: boolean
  latencyMs: number
  error?: string
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.DIAG_TOKEN
  if (!expected) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[/api/_diag/health] DIAG_TOKEN not configured — allowing request (dev only).',
      )
      return true
    }
    return false
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && auth.slice(7).trim() === expected) {
    return true
  }
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam && tokenParam === expected) return true
  return false
}

/**
 * Generyczny wrapper: timer + timeout + try/catch. Każdy `check*` przekazuje
 * tu lambdę i nie martwi się ramą wokół.
 */
async function timed(
  name: string,
  fn: () => Promise<unknown>,
): Promise<CheckResult> {
  const startedAt = Date.now()
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} check timed out after ${CHECK_TIMEOUT_MS}ms`)),
          CHECK_TIMEOUT_MS,
        ),
      ),
    ])
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkSupabase(): Promise<CheckResult> {
  return timed('supabase', async () => {
    const supabase = getSupabaseAdmin()
    // Najtańszy realistyczny check: SELECT 1 column z LIMIT 1.
    // `profiles` ZAWSZE istnieje (auth.users → trigger), więc nawet
    // przy pustej bazie ping przejdzie (limit zwróci 0 rows ale 200 OK).
    const { error } = await supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    if (error) throw new Error(error.message)
  })
}

async function checkKv(): Promise<CheckResult> {
  return timed('kv', async () => {
    const probeKey = `diag:health:probe:${Date.now()}`
    await kv.set(probeKey, '1', { ex: 5 })
    const got = await kv.get(probeKey)
    if (got !== '1' && got !== 1) {
      throw new Error(`KV roundtrip mismatch — got: ${JSON.stringify(got)}`)
    }
  })
}

async function checkGroq(): Promise<CheckResult> {
  return timed('groq', async () => {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured')
    }
    // OPTIONS — zerokosztowy preflight do Groqa, sprawdza DNS+TLS+auth
    // bez płatnego LLM calla. Groq odpowiada 204 lub 200 dla preflightu.
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'OPTIONS',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    })
    // Akceptujemy 200/204 (preflight OK) i 405 (Groq nie obsługuje OPTIONS,
    // ale gdy DNS+TLS dotarły do API gateway, to znaczy że żyje). Cokolwiek
    // 5xx = padł.
    if (res.status >= 500) {
      throw new Error(`Groq returned HTTP ${res.status}`)
    }
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
  if (!isAuthorized(req)) return unauthorized()

  const [supabase, kvResult, groq, circuitBreaker] = await Promise.all([
    checkSupabase(),
    checkKv(),
    checkGroq(),
    getCircuitStatus(),
  ])

  // `overall` = najsłabsze ogniwo. Supabase/KV padłe → `down` (chatbot nie
  // może działać). Groq padły LUB CB OPEN → `degraded` (chatbot serwuje
  // friendly fallback, ale produkt jako całość żyje).
  const supabaseOk = supabase.ok
  const kvOk = kvResult.ok
  const groqOk = groq.ok && circuitBreaker.state !== 'OPEN'

  let overall: 'ok' | 'degraded' | 'down'
  if (!supabaseOk || !kvOk) {
    overall = 'down'
  } else if (!groqOk) {
    overall = 'degraded'
  } else {
    overall = 'ok'
  }

  const status = overall === 'down' ? 503 : 200

  return new Response(
    JSON.stringify(
      {
        overall,
        ts: new Date().toISOString(),
        checks: {
          supabase,
          kv: kvResult,
          groq,
        },
        circuitBreaker,
      },
      null,
      2,
    ),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...CORS_HEADERS,
      },
    },
  )
}
