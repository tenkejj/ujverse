/**
 * UJverse — adapter subskrypcji wykładowców („Mój Plan").
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import type { LecturerSubscription } from '../../types'

/**
 * Surowy wynik RPC `public.search_lecturers`. Używamy go w autocomplete
 * dodawania subskrypcji — dedup po kluczu po stronie SQL, sort po świeżości
 * + częstotliwości.
 */
export type LecturerSuggestion = {
  lecturer_name: string
  lecturer_key: string
  announcement_count: number
  latest_at: string | null
}

/**
 * Wynik fan-out per wykładowca dla widoku „Mój Plan" — N najnowszych
 * komunikatów dla zadanego klucza. Trzymamy strukturę płaską (1 row =
 * 1 announcement) — agregację per-lecturer robi widok po stronie klienta.
 */
export type LecturerSubscriptionAnnouncement = {
  id: string
  lecturer_name: string
  body: string
  /** Union 1:1 z `AnnouncementStatus` w `types/content.ts` (po migracji 20260715). */
  status: 'cancelled' | 'remote' | 'duty' | 'info' | 'event'
  department: string | null
  created_at: string
}

class LecturerSubscriptionsAdapterImpl {
  /** Subskrypcje bieżącego użytkownika (RLS odfiltruje obce). */
  async listForUser(
    userId: string,
  ): Promise<{ data: LecturerSubscription[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('lecturer_subscriptions')
      .select('id, user_id, display_name, lecturer_key, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return { data: (data ?? []) as LecturerSubscription[], error }
  }

  /**
   * Idempotentne dodanie subskrypcji.
   *
   * UNIQUE(user_id, lecturer_key) gwarantuje że ponowny INSERT na tę samą
   * znormalizowaną nazwę zwróci błąd 23505 — interpretujemy to jako sukces
   * („już subskrybujesz") i pobieramy istniejący wiersz.
   *
   * `display_name` zostaje taki jak wprowadził user; lecturer_key liczy DB
   * (kolumna GENERATED), więc nie da się ich rozsynchronizować.
   */
  async subscribe(
    userId: string,
    displayName: string,
  ): Promise<{ data: LecturerSubscription | null; error: PostgrestError | null }> {
    const trimmed = displayName.trim()
    if (!trimmed) {
      return {
        data: null,
        error: {
          message: 'display_name cannot be empty',
          details: '',
          hint: '',
          code: 'PGRST116',
          name: 'PostgrestError',
        } as PostgrestError,
      }
    }

    const { data, error } = await supabase
      .from('lecturer_subscriptions')
      .insert({ user_id: userId, display_name: trimmed })
      .select('id, user_id, display_name, lecturer_key, created_at')
      .single()

    if (error && error.code === '23505') {
      const { data: existing, error: lookupErr } = await supabase
        .from('lecturer_subscriptions')
        .select('id, user_id, display_name, lecturer_key, created_at')
        .eq('user_id', userId)
        .filter('lecturer_key', 'eq', await this.deriveKeyFromServer(trimmed))
        .maybeSingle()
      return { data: (existing as LecturerSubscription | null) ?? null, error: lookupErr }
    }

    return { data: (data as LecturerSubscription | null) ?? null, error }
  }

  /**
   * Bulk subskrypcja wielu wykładowców (np. „zasubskrybuj wszystkich z mojego
   * planu"). UNIQUE(user_id, lecturer_key) na poziomie DB + `ignoreDuplicates`
   * w upserce daje idempotencję — wykładowcy już zasubskrybowani nie są
   * tworzeni ponownie i nie powodują błędu.
   *
   * Zwracamy `inserted` (faktycznie nowe wiersze) i `requested` (ile nazwisk
   * dostaliśmy po deduplikacji po lecturer_key). Caller pokaże to userowi
   * jako toast / podsumowanie w bannerze.
   */
  async subscribeMany(
    userId: string,
    displayNames: readonly string[],
  ): Promise<{
    inserted: LecturerSubscription[]
    requested: number
    error: PostgrestError | null
  }> {
    const trimmed = Array.from(
      new Set(
        displayNames
          .map((n) => n.trim())
          .filter((n) => n.length >= 2 && n.length <= 160),
      ),
    )
    if (trimmed.length === 0) {
      return { inserted: [], requested: 0, error: null }
    }

    const rows = trimmed.map((display_name) => ({ user_id: userId, display_name }))
    const { data, error } = await supabase
      .from('lecturer_subscriptions')
      .upsert(rows, { onConflict: 'user_id,lecturer_key', ignoreDuplicates: true })
      .select('id, user_id, display_name, lecturer_key, created_at')

    return {
      inserted: (data as LecturerSubscription[] | null) ?? [],
      requested: trimmed.length,
      error,
    }
  }

  /** Usunięcie subskrypcji po id (RLS chroni przed obcymi). */
  async unsubscribe(
    userId: string,
    id: number,
  ): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('lecturer_subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return { error }
  }

  /**
   * Autocomplete dla okienka „Dodaj wykładowcę". Idzie przez RPC, żeby
   * dedup po `lecturer_key` i sort po świeżości zrobiła DB jednym round-tripem.
   * Empty query = top recent.
   */
  async suggest(query: string, limit = 20): Promise<LecturerSuggestion[]> {
    const { data, error } = await supabase.rpc('search_lecturers', {
      p_query: query ?? '',
      p_limit: Math.max(1, Math.min(50, limit)),
    })
    if (error || !Array.isArray(data)) return []
    return data as LecturerSuggestion[]
  }

  /**
   * N najnowszych komunikatów per zadany zestaw lecturer_key (do widoku
   * „Mój Plan"). Jeden query zamiast N-iteracji, sort DESC po dacie.
   */
  async listAnnouncementsForKeys(
    keys: readonly string[],
    limit = 50,
  ): Promise<LecturerSubscriptionAnnouncement[]> {
    if (keys.length === 0) return []
    // RPC nie jest potrzebne — używamy filtra IN po RPC normalizatorze.
    // PostgREST `in` wymaga listy stringów; lecturer_key liczymy w klauzuli
    // jako wyrażenie, więc używamy RPC żeby uniknąć N+1 i mieć pełny indeks.
    const { data, error } = await supabase.rpc('announcements_for_lecturer_keys', {
      p_keys: keys as string[],
      p_limit: Math.max(1, Math.min(200, limit)),
    })
    if (!error && Array.isArray(data)) {
      return data as LecturerSubscriptionAnnouncement[]
    }

    // Fallback: brak RPC (np. dev bez świeżej migracji) — najlepszy effort
    // przez prostą tabelę. Tu nie mamy indeksu po lecturer_key, ale w MVP
    // zbiory są małe, więc to OK.
    const { data: rows } = await supabase
      .from('announcements')
      .select('id, lecturer_name, body, status, department, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (!Array.isArray(rows)) return []
    const keySet = new Set(keys)
    return (rows as LecturerSubscriptionAnnouncement[])
      .filter((r) => keySet.has(deriveKeyClient(r.lecturer_name)))
      .slice(0, limit)
  }

  /**
   * Pomocnik: deryzwacja klucza po stronie serwera (RPC dla pewności że
   * mapowanie jest identyczne z `lecturer_subscriptions.lecturer_key`).
   * Używany w `subscribe` przy konflikcie unique.
   */
  private async deriveKeyFromServer(displayName: string): Promise<string> {
    const { data } = await supabase.rpc('lecturer_name_key', { p_name: displayName })
    return typeof data === 'string' && data.length > 0 ? data : deriveKeyClient(displayName)
  }
}

/**
 * Lustrzane odbicie `public.lecturer_name_key(TEXT)` z migracji 20260615100000.
 * Trzymane lokalnie WYŁĄCZNIE jako fallback dla autocomplete / cache —
 * źródłem prawdy pozostaje generowana kolumna w DB.
 */
const DIACRITICS_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}
const TITLE_RE = /\b(dr|prof|mgr|hab|inz|inż|ks|uj)\.?\b/gi

export function deriveKeyClient(name: string): string {
  const lowered = (name ?? '').toLowerCase()
  const noDiacritics = lowered.replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS_MAP[c] ?? c)
  const noTitles = noDiacritics.replace(TITLE_RE, ' ')
  const cleaned = noTitles.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned
}

export const LecturerSubscriptionsAdapter = new LecturerSubscriptionsAdapterImpl()
