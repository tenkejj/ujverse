/**
 * Wyciąganie i weryfikacja użytkownika z requestu (Edge runtime).
 *
 * Klient `BielikAdapter` (po stronie SPA) dorzuca `Authorization: Bearer <jwt>`
 * z `supabase.auth.getSession()`, jeśli sesja istnieje. Edge proxy weryfikuje
 * token przez `supabaseAdmin.auth.getUser(token)` (jeden round-trip do GoTrue,
 * brak ręcznej walidacji podpisu — `SUPABASE_JWT_SECRET` nie jest wymagany).
 *
 * Filozofia "fail-open":
 * - brak nagłówka -> `userId: null` (anonim, dziś OK — `/api/chat` od początku
 *   jest publiczny, narzędzia operują na tabelach z publicznym `select`),
 * - nieprawidłowy/wygasły token -> również `userId: null`, log do konsoli,
 * - błąd sieci do GoTrue -> `userId: null`, log do konsoli.
 *
 * Tools dostają `userId` w `ToolContext` do (a) logowania w `[AI Tool Call]`,
 * (b) ewentualnego scope'owania w przyszłych narzędziach (np. notifications).
 */

import { getSupabaseAdmin } from './supabaseAdmin.js'

export type RequestUser = {
  /** Supabase user id (UUID). `null` gdy anonim lub token niepoprawny. */
  userId: string | null
  /** Surowy JWT (gdy podano) — przydatne dla narzędzi, które muszą działać per-user RLS. */
  jwt: string | null
}

const ANONYMOUS_USER: RequestUser = { userId: null, jwt: null }

function extractBearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null
  const token = trimmed.slice(7).trim()
  return token.length > 0 ? token : null
}

export async function extractRequestUser(req: Request): Promise<RequestUser> {
  const jwt = extractBearer(req)
  if (!jwt) return ANONYMOUS_USER

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.auth.getUser(jwt)
    if (error) {
      console.warn('[auth] getUser failed:', error.message)
      return { userId: null, jwt }
    }
    const userId = data.user?.id ?? null
    return { userId, jwt }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.warn('[auth] supabase.auth.getUser threw:', msg)
    return { userId: null, jwt }
  }
}
