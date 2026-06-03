/**
 * Service-role Supabase client (Edge runtime).
 *
 * Centralizuje logikę z `api/scrape-wziks.ts` i `api/sync-search.ts`, gdzie
 * `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` był duplikowany.
 *
 * Klient lazy-singleton per cold-start: pierwsze wywołanie `getSupabaseAdmin()`
 * tworzy instancję, kolejne reużywają tej samej referencji. Dzięki temu nie
 * płacimy kosztu inicjalizacji per request, a brak `SUPABASE_SERVICE_ROLE_KEY`
 * wywala się dopiero przy faktycznym użyciu (a nie przy imporcie modułu —
 * to ważne dla testów i `MockProvider` dev path).
 *
 * Użycie wyłącznie po stronie server-only (`api/_lib/...`). NIGDY nie importować
 * z `src/` (klient SPA) — zdradzilibyśmy service-role key do bundla.
 *
 * RLS: ten klient bypassuje wszystkie polityki Row Level Security. Stosujemy
 * go świadomie w kontekście Tools (Function Calling), gdzie chcemy stabilnych
 * odczytów niezależnych od sesji. Każde narzędzie samo decyduje, czy filtrować
 * po `user_id` z `ToolContext`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl) {
    throw new Error('supabaseAdmin: missing SUPABASE_URL (or VITE_SUPABASE_URL)')
  }
  if (!serviceRoleKey) {
    throw new Error('supabaseAdmin: missing SUPABASE_SERVICE_ROLE_KEY')
  }

  // Defensywnie: jeśli ktoś wkleił anon key jako service role — wywal się
  // głośno zamiast cicho odczytywać tylko publiczne tabele.
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ?? process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (anonKey && anonKey === serviceRoleKey) {
    throw new Error(
      'supabaseAdmin: SUPABASE_SERVICE_ROLE_KEY misconfigured (matches anon key)',
    )
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return cachedClient
}
