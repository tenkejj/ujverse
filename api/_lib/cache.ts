/**
 * `TTLMemoryCache` — minimalny in-memory cache z TTL per-wpis.
 *
 * Cel: ograniczyć liczbę zapytań do Supabase, gdy model w pętli Function
 * Calling kilkukrotnie woła to samo narzędzie z tymi samymi argumentami
 * (typowy wzorzec llama-3.1-8b — model "myśli na głos" i potrafi powtórzyć
 * to samo `tool_call` w kolejnej iteracji).
 *
 * Zakres pamięci: per process. Vercel Edge cold-start zeruje cache, ale
 * w obrębie pojedynczego cold-instance (a tym bardziej w obrębie jednego
 * requestu z 3 iteracjami pętli) trafienie cache'u jest realne i tanie.
 *
 * Świadomie BEZ:
 * - LRU / max-size — najgorszy przypadek to ~10 wpisów na request, każdy
 *   ważny 60s; pamięć rośnie symbolicznie i czyści ją cold-start.
 * - serializacji do KV/Redis — cache jest hint, nie source of truth;
 *   miss zawsze prowadzi do świeżego zapytania do bazy.
 * - sygnatur kryptograficznych — kolizje hashy są tu tylko kosztem
 *   poprawności wyniku narzędzia, nie security boundary.
 */

/** TTL domyślny dla narzędzi: 60s (gdy wpis nie ma własnego limitu). */
export const TOOL_CACHE_TTL_MS = 60_000

/**
 * TTL per nazwa narzędzia. Dobrane do dynamiki źródła:
 * - **announcements** (60s) — komunikaty wydziałowe scrapowane co kilka minut
 *   przez `api/scrape-wziks.ts`. 60s daje świeżość, ale chroni przed flood-em.
 * - **events** (300s = 5 min) — wydarzenia zmieniają się rzadko, wstawiane
 *   ręcznie lub przez ingest. Można sobie pozwolić na większy bufor.
 * - **posts** (30s) — najbardziej "social" feed; user oczekuje, że odpowiedź
 *   asystenta uwzględnia bardzo świeże wpisy (np. dyskusja sprzed minuty).
 *
 * Klucze MUSZĄ być zgodne z `tool.name` z `registry.ts` — orchestrator
 * (`registerTool`) sięga po wartość po nazwie narzędzia.
 */
export const TOOL_TTL_MS: Record<string, number> = {
  get_latest_announcements: 60_000,
  search_events: 300_000,
  get_latest_posts: 30_000,
}

export function ttlForTool(name: string): number {
  return TOOL_TTL_MS[name] ?? TOOL_CACHE_TTL_MS
}

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class TTLMemoryCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs: number = TOOL_CACHE_TTL_MS) {
    this.defaultTtlMs = defaultTtlMs
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs)
    this.store.set(key, { value, expiresAt })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  /**
   * Liczba aktywnych (nie wygasłych) wpisów. Świadomie liniowa — używane
   * tylko w testach / debugowaniu, nie na hot path.
   */
  size(): number {
    let count = 0
    const now = Date.now()
    for (const entry of this.store.values()) {
      if (entry.expiresAt >= now) count++
    }
    return count
  }
}

/**
 * Stabilny klucz dla pary `(toolName, args)`. Kolejność kluczy w `args` nie
 * powinna wpływać na hash — `JSON.stringify` z posortowanymi kluczami daje
 * deterministyczny output. Hash (FNV-1a 32-bit) jest tani i wystarczy do
 * cache'u (nie chronimy się przed kolizjami złośliwymi — patrz moduł docstring).
 */
export function buildToolCacheKey(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const canonical = stableStringify(args)
  return `${toolName}::${fnv1a32(canonical)}::${canonical.length}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
  return `{${parts.join(',')}}`
}

/**
 * FNV-1a 32-bit. Nie kryptograficzny; długość ~8 znaków hex. Wystarcza do
 * dedupy w obrębie jednego cold-instance Edge.
 */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
