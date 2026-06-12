/**
 * UJverse — proxy fetch dla USOSweb iCalendar feedu.
 *
 * Po co to istnieje:
 *   USOSweb daje przy „Eksport do iCalendar" gotowy URL postaci
 *   `https://apps.usos.uj.edu.pl/services/tt/upcoming_ical?lang=pl&user_id=...&key=...`,
 *   który zwraca surowy `text/calendar`. Klient SPA NIE może fetchować go
 *   bezpośrednio z przeglądarki bo apps.usos.uj.edu.pl nie wystawia
 *   `Access-Control-Allow-Origin` (CORS preflight = blok). Ten endpoint
 *   to cienka warstwa: walidacja URL → fetch upstream → zwrot tekstu.
 *
 * Dlaczego whitelist hosta a nie open proxy:
 *   `key` w URL działa jak długoterminowy bearer (USOSweb nie wymaga
 *   sesji JWT do tego feedu). Jeśli zrobilibyśmy open proxy z dowolnym
 *   URL-em, ktoś mógłby przepuścić przez nas SSRF do internal services
 *   Vercela / atakować innych. Twardo whitelistujemy host = apps.usos.uj.edu.pl
 *   + ścieżka = /services/tt/upcoming_ical.
 *
 * Auth + rate-limit:
 *   - Opcjonalny Bearer JWT (przepuszczamy też anonimów — feed jest sam
 *     w sobie chroniony `key`, nie ma sensu wymagać sesji).
 *   - Token bucket per user/IP (5 req / 12s refill = ~5 RPM steady) —
 *     defense in depth przed zatkaniem outbound networkingu.
 *
 * Body limits:
 *   USOSweb zwraca typowo 50–150 KB ICS. Hard cap 2 MB chroni przed
 *   awariami / wrogim upstream.
 */

import { extractRequestUser } from './_lib/auth.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
  type RateLimitConfig,
} from './_lib/ipRateLimit.js'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const RATE_LIMIT: RateLimitConfig = {
  // 5 importów na refill ≈ user wkleja URL kilkukrotnie pod rząd jeśli się
  // pomylił, ale nie pozwala botom na masowy probing kluczy.
  capacity: 5,
  refillSeconds: 12,
}

/** Whitelist: tylko apps.usos.uj.edu.pl. */
const ALLOWED_HOST = 'apps.usos.uj.edu.pl'

/**
 * Whitelist ścieżek (prefiksów). USOSweb ma kilka feedów ICS o podobnej
 * konwencji — `upcoming_ical` to standardowy „nadchodzące zajęcia",
 * `tt_user_ical` historycznie też się pojawiał. Zostawiamy oba prefiksy
 * w whiteliście, żeby nie zepsuć importu jeśli użytkownik trafił na
 * starszy URL.
 */
const ALLOWED_PATH_PREFIXES = ['/services/tt/upcoming_ical', '/services/tt/tt_user_ical']

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 20_000

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

type ValidatedUrl = { ok: true; url: URL } | { ok: false; reason: string }

function validateUsosUrl(raw: unknown): ValidatedUrl {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'Brak parametru "url".' }
  }
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'Niepoprawny URL (nie udało się sparsować).' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'URL musi używać protokołu HTTPS.' }
  }
  if (parsed.hostname.toLowerCase() !== ALLOWED_HOST) {
    return {
      ok: false,
      reason: `URL musi być z hosta ${ALLOWED_HOST} (wkleiłeś: ${parsed.hostname}).`,
    }
  }
  const pathOk = ALLOWED_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
  if (!pathOk) {
    return {
      ok: false,
      reason:
        'Ten URL nie wygląda na eksport iCalendar z USOSweb (oczekiwana ścieżka /services/tt/upcoming_ical).',
    }
  }
  // `key` musi być obecny i niepusty — bez niego upstream zwróci 401/403
  // i nie ma sensu nawet próbować.
  const key = parsed.searchParams.get('key')
  if (!key || key.trim().length < 8) {
    return {
      ok: false,
      reason: 'URL nie zawiera prawidłowego parametru "key" (z eksportu USOSweb).',
    }
  }
  return { ok: true, url: parsed }
}

async function readUrlFromRequest(req: Request): Promise<string | null> {
  if (req.method === 'GET') {
    return new URL(req.url).searchParams.get('url')
  }
  if (req.method === 'POST') {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        const body = (await req.json()) as { url?: unknown } | null
        const url = body?.url
        return typeof url === 'string' ? url : null
      } catch {
        return null
      }
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      try {
        const text = await req.text()
        return new URLSearchParams(text).get('url')
      } catch {
        return null
      }
    }
    // Last-resort: traktujemy całe body jako URL (np. fetch z `body: url`).
    try {
      const text = await req.text()
      return text.trim() || null
    } catch {
      return null
    }
  }
  return null
}

async function fetchWithTimeout(target: URL): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    return await fetch(target.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
        'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.6',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Czyta body z hard capem `MAX_RESPONSE_BYTES`. Edge runtime nie ma
 * `req.body.size`, więc czytamy stream aż do limitu i przerywamy.
 */
async function readBoundedText(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
      throw new Error(
        `Plan przekracza limit ${Math.floor(MAX_RESPONSE_BYTES / (1024 * 1024))} MB.`,
      )
    }
    chunks.push(value)
  }
  // Composing a single Uint8Array byłoby `Buffer.concat` — w Edge robimy
  // ręcznie, bez Node Buffer.
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed')
  }

  const user = await extractRequestUser(req)
  const rateKey = user.userId
    ? `usos-ics:${user.userId}`
    : `usos-ics:ip:${extractClientIp(req)}`
  const rate = checkAndConsumeRateLimit(rateKey, RATE_LIMIT)
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Za szybko. Spróbuj za ${Math.ceil(rate.retryAfterMs / 1000)} s.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
          ...CORS_HEADERS,
        },
      },
    )
  }

  const rawUrl = await readUrlFromRequest(req)
  const validation = validateUsosUrl(rawUrl)
  if (!validation.ok) {
    return jsonError(400, validation.reason)
  }

  let upstream: Response
  try {
    upstream = await fetchWithTimeout(validation.url)
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    if (isAbort) {
      return jsonError(504, 'USOSweb nie odpowiedział w czasie 20 s.')
    }
    const msg = err instanceof Error ? err.message : 'Network error'
    return jsonError(502, `Nie udało się połączyć z USOSweb: ${msg}`)
  }

  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonError(
        401,
        'USOSweb odrzucił klucz (401/403). Wygeneruj nowy URL w „Eksport do iCalendar".',
      )
    }
    if (upstream.status === 404) {
      return jsonError(404, 'USOSweb zwrócił 404 — sprawdź czy URL jest aktualny.')
    }
    return jsonError(upstream.status, `USOSweb odpowiedział kodem ${upstream.status}.`)
  }

  let body: string
  try {
    body = await readBoundedText(upstream)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Nie udało się odczytać odpowiedzi.'
    return jsonError(413, msg)
  }

  // Bardzo prosty sanity check — USOSweb czasem oddaje HTML błędu z 200,
  // a nie ICS. Wymagamy nagłówka VCALENDAR.
  const head = body.slice(0, 64).toUpperCase().trimStart()
  if (!head.startsWith('BEGIN:VCALENDAR')) {
    return jsonError(
      502,
      'USOSweb zwrócił coś, co nie wygląda na plik iCalendar. Spróbuj ponownie wygenerować link.',
    )
  }

  return new Response(JSON.stringify({ ics: body, bytes: body.length }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  })
}
