/**
 * `/api/diag/cache-stats` — diag endpoint pokazujący metryki cache + latency.
 *
 * Token-gated: wymaga nagłówka `Authorization: Bearer <DIAG_TOKEN>` ALBO
 * query `?token=<DIAG_TOKEN>`. `DIAG_TOKEN` siedzi w env (tylko prod);
 * w dev (`NODE_ENV !== 'production'`) endpoint jest otwarty (warn w logu).
 *
 * Zwraca JSON:
 * {
 *   counters: {
 *     "response_cache:hit": 42,
 *     "response_cache:miss": 13,
 *     "fast_path:hit": 8,
 *     "fast_path:miss": 47,
 *     "tool_cache:hit:search_discounts": 5,
 *     "tool_cache:miss:search_discounts": 1,
 *     "groq:served": 12,
 *     "groq:tool:search_events": 3,
 *     ...
 *   },
 *   latency: {
 *     "chat:total_ms":      { count: 55, p50: 320, p95: 1200, avg: 480, min: 12, max: 1850 },
 *     "chat:fast_path_ms":  { count: 8,  p50: 280, ...                                       },
 *     "chat:groq_path_ms":  { count: 12, p50: 1450, ...                                      },
 *     "tool:search_events_ms": { count: 7, p50: 95, ... }
 *   },
 *   derived: {
 *     "response_cache:hit_rate": 0.76,    // hit / (hit + miss)
 *     "fast_path:hit_rate":      0.15,
 *     "tool_cache:hit_rate":     0.42
 *   }
 * }
 *
 * Skala: jest to manual fetch (admin debug), nie jest hot path. Bez
 * cache'owania tej odpowiedzi — chcemy zawsze świeże dane.
 *
 * NIE LOGUJEMY tu Supabase ani user-data. Jedyne co wycieka to liczniki
 * tool-name'ów (publiczna informacja: nasze narzędzia są w `intentRouter.ts`),
 * więc nawet jeśli token wyciekłby, nikt nie pozna danych użytkownika.
 */
import {
  getAllCounters,
  getLatencyStats,
  resetAllMetrics,
} from '../_lib/metrics.js'
import { getStatus as getCircuitStatus } from '../_lib/groqCircuitBreaker.js'

export const config = { runtime: 'nodejs' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
        '[/api/diag/cache-stats] DIAG_TOKEN not configured — allowing request (dev only).',
      )
      return true
    }
    return false
  }
  // Header (preferowane).
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ') && auth.slice(7).trim() === expected) {
    return true
  }
  // Query (fallback dla wygody „odpalę z przeglądarki").
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam && tokenParam === expected) return true
  return false
}

function buildHitRate(
  counters: Record<string, number>,
  hitKey: string,
  missKey: string,
): number | null {
  const hits = counters[hitKey] ?? 0
  const misses = counters[missKey] ?? 0
  const total = hits + misses
  if (total === 0) return null
  return Math.round((hits / total) * 1000) / 1000
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (!isAuthorized(req)) return unauthorized()

  // DELETE wymaga jeszcze jednego potwierdzenia w body — explicit „chcę zerować".
  // Inaczej można by przez przypadek wyczyścić metryki przy refreshu strony,
  // jeśli dashboard wysyłałby DELETE bez pytania.
  if (req.method === 'DELETE') {
    let confirm = false
    try {
      const ct = req.headers.get('content-type') ?? ''
      if (ct.toLowerCase().includes('application/json')) {
        const body = (await req.json()) as { confirm?: unknown }
        confirm = body?.confirm === true
      }
    } catch {
      // ignore body parse errors — `confirm` zostaje `false`
    }
    if (!confirm) {
      return new Response(
        JSON.stringify({
          error: 'confirm:true required in body to reset metrics',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        },
      )
    }
    const cleared = await resetAllMetrics()
    console.warn(
      '[/api/diag/cache-stats] metrics reset — cleared keys:',
      cleared,
    )
    return new Response(JSON.stringify({ ok: true, cleared }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  const [counters, latency, circuitBreaker] = await Promise.all([
    getAllCounters(),
    getLatencyStats(),
    getCircuitStatus(),
  ])

  // Derived hit-rates — najpopularniejsze pytanie podczas debug'u.
  const derived: Record<string, number | null> = {
    'response_cache:hit_rate': buildHitRate(
      counters,
      'response_cache:hit',
      'response_cache:miss',
    ),
    'fast_path:hit_rate': buildHitRate(
      counters,
      'fast_path:hit',
      'fast_path:miss',
    ),
    'tool_cache:hit_rate': buildHitRate(
      counters,
      'tool_cache:hit',
      'tool_cache:miss',
    ),
  }

  return new Response(
    JSON.stringify({ counters, latency, derived, circuitBreaker }, null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...CORS_HEADERS,
      },
    },
  )
}
