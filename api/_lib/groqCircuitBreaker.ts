/**
 * Circuit Breaker dla wywołań Groqa.
 *
 * Problem: gdy Groq zwraca burst 429/5xx (np. organizational rate limit
 * w godzinach szczytu), KAŻDY user płaci ~3-5s timeout zanim klient
 * zobaczy „Asystent łapie oddech". Skutek: kaskada — czekający userzy
 * trzymają otwarte requesty, my płacimy za czas funkcji, doświadczenie
 * leży.
 *
 * Rozwiązanie: prosty 3-stanowy circuit breaker z licznikiem w KV
 * (cross-instance, bo Edge functions są bezstanowe i load-balancer
 * rozrzuca po regionach):
 *
 *   CLOSED      — wszystko działa, requesty lecą do Groqa.
 *   OPEN        — ostatnie N requestów dało error, blokujemy na T sekund;
 *                 caller dostaje natychmiastowy graceful fallback bez
 *                 czekania na timeout Groqa.
 *   HALF_OPEN   — po expiry OPEN, pierwszy request leci jako „probe";
 *                 sukces → CLOSED, błąd → OPEN ponownie.
 *
 * Konfiguracja:
 *  - WINDOW_SEC: rolling window do liczenia errorów (60s)
 *  - ERROR_THRESHOLD: ile errorów w window otwiera obwód (5)
 *  - OPEN_DURATION_SEC: ile sekund obwód pozostaje OPEN (30)
 *
 * Te parametry są celowo „luźne" — nie chcemy zamykać przy 1-2 timeoutach,
 * Groq potrafi mieć stabilne 30-50 RPS na nasz key, error rate <2% to
 * normal. ERROR_THRESHOLD=5 oznacza że trip-ujemy dopiero przy ~10% error
 * rate w 60s.
 *
 * KV layout:
 *   groq:cb:errors            — list (LPUSH/LTRIM) z timestampami błędów
 *   groq:cb:open_until        — int (epoch sec) do kiedy obwód jest OPEN
 *
 * Wszystkie operacje są fire-and-forget przy błędzie KV — stan domyślny
 * to CLOSED, więc niedostępny KV nie blokuje Groqa (fail-open).
 */
import { kv } from '@vercel/kv'
import { incrCounter } from './metrics.js'

const CB_ERRORS_KEY = 'groq:cb:errors'
const CB_OPEN_UNTIL_KEY = 'groq:cb:open_until'
const CB_PROBE_LOCK_KEY = 'groq:cb:probe_lock'

const WINDOW_SEC = 60
const ERROR_THRESHOLD = 5
const OPEN_DURATION_SEC = 30
const ERROR_LIST_MAX_SIZE = 50

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export type GateDecision =
  | { allow: true; state: 'CLOSED' | 'HALF_OPEN' }
  | { allow: false; state: 'OPEN'; openUntilEpochSec: number; retryAfterSec: number }

/**
 * Wspólna decyzja gate'u: „czy mogę zawołać Groqa?". Sprawdza `open_until`,
 * jeśli minęło — wyznacza HALF_OPEN (pojedynczy probe). Jeśli OPEN trzyma
 * — zwraca odmowę z `retryAfterSec`.
 *
 * NIE sprawdzamy histerezy errorów tutaj — to robi `recordError`. Gate
 * jest tani (1 GET z KV), wywoływany na każdy request.
 */
export async function gate(): Promise<GateDecision> {
  try {
    const openUntilRaw = await kv.get<number | string>(CB_OPEN_UNTIL_KEY)
    const openUntil = openUntilRaw == null ? 0 : Number(openUntilRaw)
    const now = Math.floor(Date.now() / 1000)

    if (openUntil > now) {
      return {
        allow: false,
        state: 'OPEN',
        openUntilEpochSec: openUntil,
        retryAfterSec: openUntil - now,
      }
    }

    if (openUntil > 0 && openUntil <= now) {
      // Recently elapsed — przepuszczamy 1 probe (HALF_OPEN). `setnx`
      // gwarantuje że tylko PIERWSZY caller w tym oknie dostaje probe;
      // pozostali jadą jak CLOSED. Akceptowalne — chcemy probe SZYBKO,
      // a nie przeciągać OPEN z tylko 1 user/sec.
      const acquired = await kv.set(CB_PROBE_LOCK_KEY, '1', {
        nx: true,
        ex: 5,
      })
      if (acquired) {
        return { allow: true, state: 'HALF_OPEN' }
      }
    }

    return { allow: true, state: 'CLOSED' }
  } catch (err) {
    console.warn(
      '[CircuitBreaker] gate() KV read failed — fail-open (CLOSED).',
      err instanceof Error ? err.message : String(err),
    )
    return { allow: true, state: 'CLOSED' }
  }
}

/**
 * Rejestruje SUKCES wywołania Groqa. Czyści `open_until` (gdybyśmy byli w
 * HALF_OPEN i probe się udał — wracamy do CLOSED). Nie czyścimy listy
 * errorów — sama wygaśnie przez `WINDOW_SEC` (LTRIM by-time nie istnieje
 * w Redis, ale list jest bounded `LTRIM 0 49` więc max 50 timestampów,
 * starsze i tak wypadają).
 */
export async function recordSuccess(): Promise<void> {
  try {
    await kv.del(CB_OPEN_UNTIL_KEY)
  } catch (err) {
    console.warn(
      '[CircuitBreaker] recordSuccess() KV del failed — ignored.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Rejestruje BŁĄD wywołania Groqa. Wkłada timestamp do listy, sprawdza
 * ile timestampów jest w `WINDOW_SEC` od teraz; gdy >= ERROR_THRESHOLD,
 * otwiera obwód na `OPEN_DURATION_SEC`.
 *
 * Wywoływane TYLKO dla błędów które wskazują na groqa-side problem:
 *  - 429 (rate limit organizational/per-key)
 *  - 5xx (server error)
 *
 * NIE wywoływane dla 4xx (40x logic errors w naszym requeście — to nasz
 * bug, nie problem Groqa).
 */
export async function recordError(opts: {
  status: number | null
  reason: string
}): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000)
    await kv.lpush(CB_ERRORS_KEY, now)
    await kv.ltrim(CB_ERRORS_KEY, 0, ERROR_LIST_MAX_SIZE - 1)

    // Liczymy ile timestampów mieści się w aktualnym window — `lrange`
    // daje newest-first (LPUSH), więc bierzemy pierwszy >= cutoff.
    const raw = (await kv.lrange<string | number>(
      CB_ERRORS_KEY,
      0,
      ERROR_LIST_MAX_SIZE - 1,
    )) ?? []
    const cutoff = now - WINDOW_SEC
    let recent = 0
    for (const t of raw) {
      const ts = typeof t === 'number' ? t : Number(t)
      if (Number.isFinite(ts) && ts >= cutoff) recent += 1
    }

    void incrCounter('groq:cb:error')
    void incrCounter(`groq:cb:error:${opts.reason}`)

    if (recent >= ERROR_THRESHOLD) {
      const openUntil = now + OPEN_DURATION_SEC
      await kv.set(CB_OPEN_UNTIL_KEY, openUntil, { ex: OPEN_DURATION_SEC + 5 })
      void incrCounter('groq:cb:opened')
      console.warn(
        '[CircuitBreaker] OPENING circuit — errors in window:',
        recent,
        '| threshold:',
        ERROR_THRESHOLD,
        '| openFor:',
        OPEN_DURATION_SEC,
        's | reason:',
        opts.reason,
        '| status:',
        opts.status,
      )
    }
  } catch (err) {
    console.warn(
      '[CircuitBreaker] recordError() KV op failed — ignored (CB stays CLOSED).',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Zwraca aktualny stan + metryki (do diag endpointu i debugowania).
 * Tani odczyt, używać w `/api/diag/cache-stats`.
 */
export type CircuitStatus = {
  state: CircuitState
  openUntilEpochSec: number | null
  retryAfterSec: number | null
  recentErrors: number
}

export async function getStatus(): Promise<CircuitStatus> {
  try {
    const [openUntilRaw, raw] = await Promise.all([
      kv.get<number | string>(CB_OPEN_UNTIL_KEY),
      kv.lrange<string | number>(CB_ERRORS_KEY, 0, ERROR_LIST_MAX_SIZE - 1),
    ])
    const now = Math.floor(Date.now() / 1000)
    const openUntil = openUntilRaw == null ? 0 : Number(openUntilRaw)
    const list = raw ?? []
    const cutoff = now - WINDOW_SEC
    let recent = 0
    for (const t of list) {
      const ts = typeof t === 'number' ? t : Number(t)
      if (Number.isFinite(ts) && ts >= cutoff) recent += 1
    }
    let state: CircuitState = 'CLOSED'
    if (openUntil > now) state = 'OPEN'
    return {
      state,
      openUntilEpochSec: openUntil > now ? openUntil : null,
      retryAfterSec: openUntil > now ? openUntil - now : null,
      recentErrors: recent,
    }
  } catch (err) {
    console.warn(
      '[CircuitBreaker] getStatus() failed — reporting CLOSED.',
      err instanceof Error ? err.message : String(err),
    )
    return {
      state: 'CLOSED',
      openUntilEpochSec: null,
      retryAfterSec: null,
      recentErrors: 0,
    }
  }
}
