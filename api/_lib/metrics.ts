/**
 * Metrics — proste liczniki + ring buffer latencji w KV (Upstash Redis).
 *
 * Po co osobno od `kvCache.ts`: liczniki MUSZĄ być atomic (`incr`), a nasze
 * helpery KV operują na `set` (string→string mapping z `JSON` w środku).
 * Tutaj sięgamy po `kv.incr` / `kv.lpush` / `kv.ltrim` bezpośrednio,
 * z owinięciem w try/catch (degradujemy do no-op gdy KV padnie).
 *
 * Klucze (przestrzenie):
 *   metrics:counter:<scope>             — pojedynczy licznik (np. response_cache_hit)
 *   metrics:lat:<bucket>                — list (RPUSH/LTRIM 200) z ms latencji
 *
 * Sposób użycia:
 *   await incrCounter('response_cache:hit')
 *   await pushLatency('chat:total', elapsedMs)
 *
 * Dump (`/api/_diag/cache-stats`) odpalamy `getAllCounters` + `getLatencyStats`,
 * łączymy w jeden JSON, gardujemy tokenem.
 *
 * Uwaga: nie cache'ujemy żadnych odczytów — diag endpoint robi 2-3 round-tripy
 * do Redisa rzadko (manual fetch / dashboard), więc opłacalność cache'owania
 * minimalna, a ryzyko stale-data wysokie.
 */
import { kv } from '@vercel/kv'

const COUNTER_PREFIX = 'metrics:counter:'
const LATENCY_PREFIX = 'metrics:lat:'
const COUNTER_KEYS_SET = 'metrics:counter_keys'
const LATENCY_KEYS_SET = 'metrics:latency_keys'
const RING_SIZE = 200

/**
 * Atomic increment. Inicjalizacja wbudowana w `incr` (Redis tworzy klucz
 * z wartością 1 gdy go nie ma). Klucz dorzucamy do indeksu (`SADD`), żeby
 * diag endpoint wiedział co listować — `SCAN` byłby OK, ale utrzymanie
 * własnego setu jest deterministyczne i tańsze.
 */
export async function incrCounter(scope: string, by = 1): Promise<void> {
  try {
    const key = COUNTER_PREFIX + scope
    if (by === 1) {
      await kv.incr(key)
    } else {
      await kv.incrby(key, by)
    }
    await kv.sadd(COUNTER_KEYS_SET, scope)
  } catch (err) {
    console.warn(
      '[Metrics] incrCounter failed — ignored.',
      'scope:',
      scope,
      '| err:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Push latency (ms) do ring-buffer dla danego scope'a.
 * `LPUSH` + `LTRIM 0 RING_SIZE-1` daje bounded list — najnowsze N pomiarów.
 *
 * `Math.round` żeby nie wpychać floata w Redisa (mniej miejsca, łatwiejsze
 * percentyle przy dump'ie).
 */
export async function pushLatency(
  bucket: string,
  ms: number,
): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) return
  try {
    const key = LATENCY_PREFIX + bucket
    const rounded = Math.round(ms)
    await kv.lpush(key, rounded)
    await kv.ltrim(key, 0, RING_SIZE - 1)
    await kv.sadd(LATENCY_KEYS_SET, bucket)
  } catch (err) {
    console.warn(
      '[Metrics] pushLatency failed — ignored.',
      'bucket:',
      bucket,
      '| ms:',
      ms,
      '| err:',
      err instanceof Error ? err.message : String(err),
    )
  }
}

export type CounterMap = Record<string, number>

/**
 * Zwraca wszystkie liczniki, które kiedykolwiek inkrementowały (czyli są
 * w `COUNTER_KEYS_SET`). `mget` pobiera wartości w jednym round-tripie.
 *
 * Wartości zwracane to `string` (Redis nie zna typów numerycznych przy
 * `GET`-cie), więc `Number(...)`.
 */
export async function getAllCounters(): Promise<CounterMap> {
  try {
    const scopes = (await kv.smembers(COUNTER_KEYS_SET)) as string[]
    if (scopes.length === 0) return {}
    const keys = scopes.map((s) => COUNTER_PREFIX + s)
    const values = (await kv.mget<(string | null)[]>(...keys)) ?? []
    const out: CounterMap = {}
    scopes.forEach((scope, i) => {
      const raw = values[i]
      const n = raw == null ? 0 : Number(raw)
      out[scope] = Number.isFinite(n) ? n : 0
    })
    return out
  } catch (err) {
    console.warn(
      '[Metrics] getAllCounters failed.',
      err instanceof Error ? err.message : String(err),
    )
    return {}
  }
}

export type LatencySummary = {
  count: number
  p50: number
  p95: number
  avg: number
  min: number
  max: number
}

export type LatencySummaryMap = Record<string, LatencySummary>

/**
 * Zwraca sumę statystyk per-bucket. Dla każdego bucket'a robimy `LRANGE 0 -1`,
 * sortujemy wartości i liczymy p50/p95.
 *
 * Czemu nie pre-aggregujemy: ring buffer ≤ 200 pomiarów / bucket; sortowanie
 * tablicy tej długości jest darmowe. Liczenie online w czasie zapisu wymagałoby
 * t-digest / podobnych struktur — przesada dla naszej skali.
 */
export async function getLatencyStats(): Promise<LatencySummaryMap> {
  try {
    const buckets = (await kv.smembers(LATENCY_KEYS_SET)) as string[]
    if (buckets.length === 0) return {}
    const out: LatencySummaryMap = {}
    for (const bucket of buckets) {
      const raw = (await kv.lrange(LATENCY_PREFIX + bucket, 0, -1)) as Array<
        string | number
      >
      const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      if (nums.length === 0) continue
      nums.sort((a, b) => a - b)
      const sum = nums.reduce((a, b) => a + b, 0)
      out[bucket] = {
        count: nums.length,
        min: nums[0],
        max: nums[nums.length - 1],
        avg: Math.round(sum / nums.length),
        p50: percentile(nums, 0.5),
        p95: percentile(nums, 0.95),
      }
    }
    return out
  } catch (err) {
    console.warn(
      '[Metrics] getLatencyStats failed.',
      err instanceof Error ? err.message : String(err),
    )
    return {}
  }
}

function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0
  // nearest-rank — wystarczająco dobre dla obserwowalności,
  // bez interpolacji robi się czytelnie i deterministycznie.
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil(q * sortedAsc.length) - 1),
  )
  return sortedAsc[idx]
}

/**
 * Zeruje WSZYSTKIE liczniki + ring buffery. Używaj rzadko (zwykle tylko
 * w teście / przy migracji nazw scope'ów). Zwraca count zwolnionych kluczy.
 */
export async function resetAllMetrics(): Promise<number> {
  try {
    const scopes = (await kv.smembers(COUNTER_KEYS_SET)) as string[]
    const buckets = (await kv.smembers(LATENCY_KEYS_SET)) as string[]
    const allKeys = [
      ...scopes.map((s) => COUNTER_PREFIX + s),
      ...buckets.map((b) => LATENCY_PREFIX + b),
      COUNTER_KEYS_SET,
      LATENCY_KEYS_SET,
    ]
    if (allKeys.length === 0) return 0
    await kv.del(...allKeys)
    return allKeys.length
  } catch (err) {
    console.warn(
      '[Metrics] resetAllMetrics failed.',
      err instanceof Error ? err.message : String(err),
    )
    return 0
  }
}
