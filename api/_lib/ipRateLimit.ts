/**
 * `ipRateLimit` — token-bucket rate limiter per klucz (IP lub userId),
 * uruchamiany **przed** wywołaniem Groqa w `api/chat.ts`.
 *
 * Cel: defense-in-depth przed spamem (np. ktoś trzyma Enter), żeby ograniczyć
 * eksplozję 429-ek z Groqa, gdy jedna osoba próbuje sama wyczerpać TPM
 * (6000 tokenów/min) i tym samym uszkodzić doświadczenie reszty.
 *
 * Charakterystyka algorytmu (token bucket):
 * - `capacity` (domyślnie 3) — pojemność wiadra. Pozwala na krótki burst:
 *   trzy szybkie pytania pod rząd przejdą. To świadome, bo asystent zwykle
 *   odpowiada w 2–6s i naturalna rozmowa nie powinna być penalizowana.
 * - `refillSeconds` (domyślnie 2.5) — co tyle sekund regeneruje się 1 token.
 *   Steady-state ≈ 24 RPM per klucz. Przy ~30 osobach trzymających ten sam
 *   limit nadal mieścimy się hojnie w 60 RPM Groqa.
 *
 * Granice in-memory na Edge:
 * - Pamięć żyje per ciepły instance Vercel Edge — cold start zeruje stan.
 *   To NIE jest hard guarantee (klient za NAT-em + scale-out = każdy instance
 *   ma własne wiadro). To celowy trade-off: zero infry (KV) i brak latencji
 *   round-tripu do Redis na hot path.
 * - Cap `MAX_BUCKETS=1000` z lazy eviction stałych wpisów (`STALE_AFTER_MS`)
 *   chroni przed wyciekiem pamięci przy długim ciepłym instance + dużej
 *   liczbie unikalnych IP.
 *
 * **Świadomie BEZ**: precyzyjnego globalnego limitu (wymagałby Vercel KV
 * z atomowymi inkrementami), bo na demie + dla naszego ruchu wystarczy
 * heurystyka per-instance. Jeśli kiedyś dojdzie do skali wymagającej
 * twardego globalu, przepinamy implementację na `kv.incr` z `EXPIRE`.
 */

export type RateLimitConfig = {
  /** Pojemność wiadra (max burst). */
  capacity: number
  /** Co ile sekund regeneruje się 1 token. */
  refillSeconds: number
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 3,
  refillSeconds: 2.5,
}

export type RateLimitResult = {
  allowed: boolean
  /** Ile ms zostało do następnego dostępnego tokenu (0 gdy `allowed=true`). */
  retryAfterMs: number
  /** Ile tokenów zostało po konsumpcji (zaokrąglone w dół). */
  tokensRemaining: number
}

type Bucket = {
  tokens: number
  lastRefillMs: number
}

const BUCKETS = new Map<string, Bucket>()
const MAX_BUCKETS = 1000
const STALE_AFTER_MS = 5 * 60_000

/**
 * Wyciąga klientowi IP z nagłówków Vercela. Kolejność preferencji
 * odpowiada temu, co Vercel Edge faktycznie wstawia (`x-forwarded-for`
 * to standard, `x-real-ip` to fallback, `x-vercel-forwarded-for` to
 * surowy odpowiednik gdy proxy nie przepisało).
 *
 * Zwraca `'anonymous'` jeśli żaden nagłówek nie jest dostępny — wtedy
 * wszyscy anonimowi gracze trafią do wspólnego wiadra. To celowe, woli
 * fałszywie penalizować wszystkich anonimów niż pozwolić anonimowi
 * spamować bez ograniczeń.
 */
export function extractClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xreal = req.headers.get('x-real-ip')
  if (xreal) {
    const trimmed = xreal.trim()
    if (trimmed) return trimmed
  }
  const vercelFwd = req.headers.get('x-vercel-forwarded-for')
  if (vercelFwd) {
    const first = vercelFwd.split(',')[0]?.trim()
    if (first) return first
  }
  return 'anonymous'
}

/**
 * Sprawdza i konsumuje 1 token z wiadra dla podanego `key`. Atomowość:
 * runtime Edge JS jest single-threaded per instance, więc sekwencja
 * "read bucket → refill → consume" jest atomowa w obrębie tego instance.
 *
 * UWAGA: funkcja MUTUJE stan modułu (Map). To intencjonalne — wzorzec
 * jak `RateLimiter.consume()` w bibliotekach typu `rate-limiter-flexible`.
 */
export function checkAndConsumeRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): RateLimitResult {
  const now = Date.now()
  evictStaleIfNeeded(now)

  const refillRatePerMs = 1 / (config.refillSeconds * 1000)

  let bucket = BUCKETS.get(key)
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefillMs: now }
    BUCKETS.set(key, bucket)
  } else {
    const elapsedMs = Math.max(0, now - bucket.lastRefillMs)
    const refilled = elapsedMs * refillRatePerMs
    bucket.tokens = Math.min(config.capacity, bucket.tokens + refilled)
    bucket.lastRefillMs = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return {
      allowed: true,
      retryAfterMs: 0,
      tokensRemaining: Math.floor(bucket.tokens),
    }
  }

  const missing = 1 - bucket.tokens
  const retryAfterMs = Math.max(0, Math.ceil(missing / refillRatePerMs))
  return { allowed: false, retryAfterMs, tokensRemaining: 0 }
}

/**
 * Lazy eviction wpisów starszych niż `STALE_AFTER_MS`. Uruchamia się
 * dopiero gdy Map przekroczy `MAX_BUCKETS` — przy normalnym ruchu
 * mapa pozostaje mała i nigdy nie iterujemy całości.
 */
function evictStaleIfNeeded(now: number): void {
  if (BUCKETS.size < MAX_BUCKETS) return
  for (const [key, bucket] of BUCKETS) {
    if (now - bucket.lastRefillMs > STALE_AFTER_MS) {
      BUCKETS.delete(key)
    }
  }
}

/** Tylko dla testów — reset modułowego stanu między scenariuszami. */
export function __resetRateLimitForTests(): void {
  BUCKETS.clear()
}
