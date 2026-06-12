/**
 * UJverse — adapter planu zajęć (faza 1B „Mojego Planu").
 *
 * Operacje:
 *   - `importIcs(userId, ics)`   — parse + upsert do `user_timetable_entries`
 *                                  (UNIQUE(user_id, uid) gwarantuje idempotencję).
 *   - `clear(userId)`            — usuwa wszystkie entries usera (full reset
 *                                  na żądanie z UI).
 *   - `listForRange(from, to)`   — RPC `get_timetable_for_range` z LATERAL
 *                                  matchingiem do anonsów o odwołaniach.
 *
 * Świadomie BEZ realtime channel — plan zmienia się rzadko (kilka razy
 * w semestrze przy reimporcie), nie warto utrzymywać subskrypcji.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import { parseIcs, type IcsEvent } from '../../lib/icsParser'

export type TimetableEntryRow = {
  id: number
  uid: string
  summary: string
  lecturer_name: string | null
  lecturer_key: string | null
  location: string | null
  start_time: string
  end_time: string
  /** UUID anonsa o odwołaniu (cancelled) z ostatniego okna — null gdy brak. */
  cancelled_announcement_id: string | null
  cancelled_announcement_body: string | null
  cancelled_announcement_at: string | null
}

export type ImportIcsResult = {
  parsedCount: number
  insertedCount: number
  skippedCount: number
  parserErrors: string[]
  dbError: PostgrestError | null
  /** Ustawiane gdy fetch z URL-a USOSweb się wywalił przed parsowaniem. */
  fetchError?: string | null
}

/**
 * USOSweb po „Eksport do iCalendar" daje URL postaci
 * `https://apps.usos.uj.edu.pl/services/tt/upcoming_ical?lang=pl&user_id=…&key=…`.
 * Validujemy tutaj klient-side, żeby pokazać sensowny komunikat zanim
 * pójdziemy w roundtrip do `/api/fetch-usos-ics`.
 */
export function isLikelyUsosIcsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:') return false
    if (u.hostname.toLowerCase() !== 'apps.usos.uj.edu.pl') return false
    if (!u.pathname.startsWith('/services/tt/')) return false
    const key = u.searchParams.get('key')
    return Boolean(key && key.trim().length >= 8)
  } catch {
    return false
  }
}

type InsertRow = {
  user_id: string
  uid: string
  summary: string
  lecturer_name: string | null
  location: string | null
  start_time: string
  end_time: string
  source: string
}

function toInsertRow(userId: string, ev: IcsEvent): InsertRow {
  return {
    user_id: userId,
    uid: ev.uid,
    summary: ev.summary.slice(0, 1000),
    lecturer_name: ev.lecturer ? ev.lecturer.slice(0, 160) : null,
    location: ev.location ? ev.location.slice(0, 240) : null,
    start_time: ev.startUtc.toISOString(),
    end_time: ev.endUtc.toISOString(),
    source: 'usos_ics',
  }
}

/** Dzieli na batche, żeby nie wysyłać 5000+ wierszy w jednym requeście. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

class TimetableAdapterImpl {
  async importIcs(userId: string, rawIcs: string): Promise<ImportIcsResult> {
    const { events, errors } = parseIcs(rawIcs)
    const result: ImportIcsResult = {
      parsedCount: events.length,
      insertedCount: 0,
      skippedCount: 0,
      parserErrors: errors,
      dbError: null,
    }
    if (events.length === 0) return result

    const rows = events.map((ev) => toInsertRow(userId, ev))
    for (const batch of chunk(rows, 200)) {
      const { error, count } = await supabase
        .from('user_timetable_entries')
        .upsert(batch, {
          onConflict: 'user_id,uid',
          ignoreDuplicates: false,
          count: 'exact',
        })
      if (error) {
        result.dbError = error
        return result
      }
      result.insertedCount += count ?? batch.length
    }
    result.skippedCount = result.parsedCount - result.insertedCount
    return result
  }

  /**
   * Pobiera surowy ICS z USOSweb przez nasz proxy endpoint
   * (`/api/fetch-usos-ics`) i deleguje do `importIcs`. Robimy to przez
   * proxy bo apps.usos.uj.edu.pl nie wystawia CORS-ów dla naszej domeny.
   *
   * Dorzuca `Authorization: Bearer <jwt>` jeśli jest sesja — endpoint go
   * używa tylko do rate-limitu (per user zamiast per IP), nie do auth.
   */
  async importIcsFromUrl(userId: string, url: string): Promise<ImportIcsResult> {
    const empty: ImportIcsResult = {
      parsedCount: 0,
      insertedCount: 0,
      skippedCount: 0,
      parserErrors: [],
      dbError: null,
      fetchError: null,
    }
    if (!isLikelyUsosIcsUrl(url)) {
      return {
        ...empty,
        fetchError:
          'URL musi być z apps.usos.uj.edu.pl i zawierać parametr "key" (skopiuj z USOSweb → Eksport do iCalendar).',
      }
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) headers['Authorization'] = `Bearer ${token}`
    } catch {
      // Anonimowy fallback — endpoint działa też bez sesji.
    }

    let res: Response
    try {
      res = await fetch('/api/fetch-usos-ics', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim() }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      return { ...empty, fetchError: `Nie udało się połączyć z proxy: ${msg}` }
    }

    if (!res.ok) {
      let message = `Proxy zwróciło ${res.status}`
      try {
        const body = (await res.json()) as { error?: string } | null
        if (body?.error) message = body.error
      } catch {
        // Body nie było JSON-em, zostawiamy generyczny komunikat.
      }
      return { ...empty, fetchError: message }
    }

    let payload: { ics?: unknown } | null = null
    try {
      payload = (await res.json()) as { ics?: unknown }
    } catch {
      return { ...empty, fetchError: 'Proxy zwróciło niepoprawne JSON.' }
    }
    const ics = payload && typeof payload.ics === 'string' ? payload.ics : null
    if (!ics) {
      return { ...empty, fetchError: 'Proxy nie zwróciło treści iCalendar.' }
    }

    return this.importIcs(userId, ics)
  }

  async clear(userId: string): Promise<{ error: PostgrestError | null; deleted: number }> {
    const { error, count } = await supabase
      .from('user_timetable_entries')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
    return { error, deleted: count ?? 0 }
  }

  /**
   * Półotwarty przedział `[from, to)`. Używaj `endOfDayUtc(today)` jako `to`,
   * żeby zajęcia kończące się o 21:30 nie wypadły z dzisiejszej listy.
   */
  async listForRange(
    from: Date,
    to: Date,
    announcementWindowHours = 168,
  ): Promise<TimetableEntryRow[]> {
    const { data, error } = await supabase.rpc('get_timetable_for_range', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_announcement_window_hours: announcementWindowHours,
    })
    if (error || !Array.isArray(data)) return []
    return data as TimetableEntryRow[]
  }

  async count(userId: string): Promise<number> {
    const { count } = await supabase
      .from('user_timetable_entries')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
    return count ?? 0
  }
}

export const TimetableAdapter = new TimetableAdapterImpl()
