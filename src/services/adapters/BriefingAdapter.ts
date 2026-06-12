/**
 * UJverse — adapter tygodniowego briefingu.
 *
 * `ensure()` to default operacja użyta z hooka — lazy generuje briefing dla
 * obecnie zalogowanego usera (RPC `ensure_weekly_briefing`). Idempotentne:
 * jeśli wiersz istnieje, RPC zwraca go bez liczenia od nowa.
 */
import { supabase } from '../../supabaseClient'
import type { WeeklyBriefingRow, WeeklyBriefingPayload } from '../../types/briefing'

type EnsureResult = {
  row: WeeklyBriefingRow | null
  error: string | null
}

/** ISO date format `YYYY-MM-DD` — to co RPC akceptuje jako DATE. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Poniedziałek tygodnia *lokalnego* (Europe/Warsaw == lokalny dla wszystkich
 *  użytkowników apki w praktyce). Klient i serwer wyliczają identyczną datę. */
export function warsawWeekStart(now: Date = new Date()): Date {
  const local = new Date(now)
  // JS: 0 = niedziela, 1 = poniedziałek, …
  const day = local.getDay()
  const diffToMonday = (day + 6) % 7
  local.setHours(0, 0, 0, 0)
  local.setDate(local.getDate() - diffToMonday)
  return local
}

class BriefingAdapterImpl {
  /**
   * Lazy generuje briefing dla obecnie zalogowanego usera na zadany tydzień
   * (default: bieżący poniedziałek). Wynik to row z `weekly_briefings`.
   */
  async ensure(weekStart?: Date): Promise<EnsureResult> {
    const isoDate = weekStart ? toIsoDate(weekStart) : null
    const { data, error } = await supabase.rpc('ensure_weekly_briefing', {
      p_week_start: isoDate,
    })
    if (error) return { row: null, error: error.message ?? 'unknown' }
    if (!data) return { row: null, error: null }
    // `ensure_weekly_briefing` zwraca SETOF weekly_briefings → klient PostgREST
    // dostarcza pojedynczy obiekt (RETURNS table row, jednorzędowo).
    const row = Array.isArray(data) ? (data[0] ?? null) : data
    return { row: row as WeeklyBriefingRow, error: null }
  }

  /**
   * Najnowszy briefing dla aktualnie zalogowanego usera (LIMIT 1 ORDER DESC).
   * Używane gdy widget montuje się a `ensure` jest zbyt agresywne (np. na
   * starym tygodniu, gdzie nie chcemy generować na nowo).
   */
  async latestForCurrentUser(): Promise<WeeklyBriefingRow | null> {
    const { data, error } = await supabase
      .from('weekly_briefings')
      .select('id, user_id, week_start, payload, generated_at')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data as WeeklyBriefingRow
  }

  /** Lista briefingów (do historycznego przeglądania). MVP używa LIMIT 8. */
  async listRecent(limit = 8): Promise<WeeklyBriefingRow[]> {
    const { data, error } = await supabase
      .from('weekly_briefings')
      .select('id, user_id, week_start, payload, generated_at')
      .order('week_start', { ascending: false })
      .limit(limit)
    if (error || !Array.isArray(data)) return []
    return data as WeeklyBriefingRow[]
  }

  /** Direct fetch po ID (deep-link z notyfikacji). */
  async getById(briefingId: number): Promise<WeeklyBriefingRow | null> {
    const { data, error } = await supabase
      .from('weekly_briefings')
      .select('id, user_id, week_start, payload, generated_at')
      .eq('id', briefingId)
      .maybeSingle()
    if (error || !data) return null
    return data as WeeklyBriefingRow
  }
}

export const BriefingAdapter = new BriefingAdapterImpl()
export type { WeeklyBriefingPayload }
