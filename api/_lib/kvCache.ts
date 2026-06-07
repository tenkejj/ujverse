/**
 * KV Cache helpers — cienka warstwa nad `@vercel/kv` (Upstash Redis przez REST).
 *
 * Cele:
 * - **Niezawodność**: każdy błąd (sieć, brak konfiguracji env, 5xx, timeout)
 *   degraduje się do "no-cache". `kvGetSafe` zwraca `undefined`,
 *   `kvSetSafe` po prostu loguje warn. Cache jest hintem, nie source of truth.
 * - **Spójny interfejs**: dwa proste API zamiast porozrzucanych try/catch
 *   wokół każdego wywołania `kv.get/set` w wielu plikach.
 * - **TTL w SEKUNDACH** (zgodnie z `kv.set(key, value, { ex: N })`). To celowo
 *   inna jednostka niż stary `TTLMemoryCache` (który używał ms) — zapobiega
 *   to przypadkowemu mieszaniu jednostek przy migracji.
 *
 * Wymagane env vars na Vercelu (auto-injected przez integrację Marketplace
 * KV / Upstash): `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`,
 * `KV_REST_API_READ_ONLY_TOKEN`. Brak którejkolwiek → `kv` rzuci przy
 * pierwszym `get/set` — my łapiemy i degradujemy do "no-cache".
 *
 * Granica: serializacja. `@vercel/kv` automatycznie robi `JSON.stringify` na
 * `set` i `JSON.parse` na `get` (gdy wartość nie jest stringiem). Dla naszych
 * use-case'ów (string z odpowiedzią chatu / obiekt wyniku narzędzia)
 * to jest in-and-out symetryczne. NIE serializujemy ręcznie po naszej stronie.
 */

import { kv } from '@vercel/kv'

/**
 * Domyślny TTL używany przez warstwę odpowiedzi chatu — 5 minut. Wybrany
 * pod kątem trade-off między świeżością danych a redukcją ekspozycji na 429.
 * Per-tool TTL trzymamy odrębnie (`cache.ts` → `TOOL_TTL_MS`); nie zlewamy
 * tych dwóch warstw, bo mają różną semantykę (response = "ten sam tekst od
 * usera", tool = "ten sam tool+args").
 */
export const KV_DEFAULT_TTL_SECONDS = 300

/**
 * Pobiera wartość z KV. ZAWSZE bezpieczne — żaden błąd nie wycieka do
 * caller-a, zwracane `undefined` oznacza MISS (tak samo jak brak klucza).
 *
 * Zwracany typ `T` jest zaufaniem dla caller-a: KV nie waliduje shape'u.
 * Jeśli inny zapis kiedyś trafił pod ten sam klucz z innym shape'em,
 * dostaniesz "niby ten typ", ale runtime check tego nie złapie. Trzymaj
 * przestrzenie nazw klucza dobrze rozdzielone (`buildToolCacheKey` to robi).
 */
export async function kvGetSafe<T>(key: string): Promise<T | undefined> {
  try {
    const value = await kv.get<T>(key)
    if (value === null || value === undefined) return undefined
    return value
  } catch (err) {
    console.warn(
      '[KVCache] get failed — fallback to no-cache. key:',
      key,
      '| err:',
      err instanceof Error ? err.message : String(err),
    )
    return undefined
  }
}

/**
 * Zapisuje wartość do KV z TTL (sekundy). Fire-and-forget z punktu widzenia
 * UX-u — błąd zapisu NIGDY nie wywraca requestu, tylko warn do logu.
 *
 * Świadomie zwracamy `Promise<void>`, żeby caller mógł `await`-ować jeśli
 * chce poczekać na potwierdzenie (np. test integracyjny), ale w prod
 * `void kvSetSafe(...)` też jest OK i nie blokuje strumienia SSE.
 */
export async function kvSetSafe<T>(
  key: string,
  value: T,
  ttlSeconds: number = KV_DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await kv.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.warn(
      '[KVCache] set failed — ignored (cache not strict). key:',
      key,
      '| ttlSec:',
      ttlSeconds,
      '| err:',
      err instanceof Error ? err.message : String(err),
    )
  }
}
