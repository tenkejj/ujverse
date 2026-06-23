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

function toInsertRow(userId: string, ev: IcsEvent, source: string): InsertRow {
  return {
    user_id: userId,
    uid: ev.uid,
    summary: ev.summary.slice(0, 1000),
    lecturer_name: ev.lecturer ? ev.lecturer.slice(0, 160) : null,
    location: ev.location ? ev.location.slice(0, 240) : null,
    start_time: ev.startUtc.toISOString(),
    end_time: ev.endUtc.toISOString(),
    source,
  }
}

/** Dzieli na batche, żeby nie wysyłać 5000+ wierszy w jednym requeście. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

class TimetableAdapterImpl {
  private async importParsedEvents(
    userId: string,
    events: IcsEvent[],
    errors: string[],
    source: string,
  ): Promise<ImportIcsResult> {
    const result: ImportIcsResult = {
      parsedCount: events.length,
      insertedCount: 0,
      skippedCount: 0,
      parserErrors: errors,
      dbError: null,
    }
    if (events.length === 0) return result

    const rows = events.map((ev) => toInsertRow(userId, ev, source))
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

  async importIcs(userId: string, rawIcs: string): Promise<ImportIcsResult> {
    const { events, errors } = parseIcs(rawIcs)
    return this.importParsedEvents(userId, events, errors, 'usos_ics')
  }

  async importSpreadsheet(userId: string, data: ArrayBuffer): Promise<ImportIcsResult> {
    const { parseSpreadsheetTimetable } = await import('../../lib/spreadsheetTimetableParser')
    const { events, errors } = parseSpreadsheetTimetable(data)
    return this.importParsedEvents(userId, events, errors, 'usos_excel')
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
          'URL musi być z apps.usos.uj.edu.pl i zawierać parametr "key" (skopiuj z USOSweb → eksport planu).',
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
      return { ...empty, fetchError: 'Proxy nie zwróciło treści planu.' }
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

  /**
   * Lista unikalnych wykładowców z planu danego usera, posortowana po
   * częstości (najczęściej spotykany na górze).
   *
   * Implementacja: pobieramy `lecturer_name` + `lecturer_key` z wszystkich
   * entries (typowy plan = 30–150 wierszy, więc bez paginacji) i agregujemy
   * w JS. RPC byłoby czystsze, ale dla rozmiaru danych nieuzasadnione.
   */
  async listDistinctLecturers(userId: string): Promise<DistinctLecturerRow[]> {
    const { data, error } = await supabase
      .from('user_timetable_entries')
      .select('lecturer_name, lecturer_key')
      .eq('user_id', userId)
      .not('lecturer_name', 'is', null)
    if (error || !Array.isArray(data)) return []

    const acc = new Map<string, DistinctLecturerRow>()
    for (const row of data as Array<{ lecturer_name: string | null; lecturer_key: string | null }>) {
      const name = row.lecturer_name?.trim()
      const key = row.lecturer_key?.trim()
      if (!name || !key) continue
      const existing = acc.get(key)
      if (existing) {
        existing.class_count += 1
        // Wybieramy „najpełniejszą" formę nazwiska (najdłuższa = z tytułami).
        if (name.length > existing.lecturer_name.length) {
          existing.lecturer_name = name
        }
      } else {
        acc.set(key, { lecturer_name: name, lecturer_key: key, class_count: 1 })
      }
    }
    return Array.from(acc.values()).sort((a, b) => b.class_count - a.class_count)
  }

  /**
   * Stats dla widoku „Mój Plan" — wszystkie zajęcia od `from` do `to` (lub
   * przyszłe gdy `from` = now). Liczymy łączny czas (godziny), zajęcia per
   * dzień tygodnia, ostatni import.
   */
  async stats(userId: string, weekStart: Date, weekEnd: Date): Promise<TimetableStats> {
    const empty: TimetableStats = {
      thisWeekCount: 0,
      thisWeekHours: 0,
      busiestDay: null,
      lastImportedAt: null,
      totalEntries: 0,
    }

    const [{ data: weekRows }, { data: lastImport, count: totalCount }] = await Promise.all([
      supabase
        .from('user_timetable_entries')
        .select('start_time, end_time')
        .eq('user_id', userId)
        .gte('start_time', weekStart.toISOString())
        .lt('start_time', weekEnd.toISOString()),
      supabase
        .from('user_timetable_entries')
        .select('imported_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('imported_at', { ascending: false })
        .limit(1),
    ])

    if (Array.isArray(weekRows)) {
      const dayCounts = new Map<number, number>()
      let totalMs = 0
      for (const row of weekRows as Array<{ start_time: string; end_time: string }>) {
        const start = new Date(row.start_time)
        const end = new Date(row.end_time)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
        const dow = start.getDay() // 0=Sun, 1=Mon, …
        dayCounts.set(dow, (dayCounts.get(dow) ?? 0) + 1)
        totalMs += end.getTime() - start.getTime()
      }
      empty.thisWeekCount = weekRows.length
      empty.thisWeekHours = Math.round((totalMs / 3_600_000) * 10) / 10
      let topDow = -1
      let topCount = 0
      for (const [dow, count] of dayCounts) {
        if (count > topCount) {
          topCount = count
          topDow = dow
        }
      }
      empty.busiestDay =
        topDow >= 0 ? { dayOfWeek: topDow, count: topCount } : null
    }

    if (Array.isArray(lastImport) && lastImport[0]) {
      const row = lastImport[0] as { imported_at?: string | null }
      empty.lastImportedAt = row.imported_at ?? null
    }
    empty.totalEntries = totalCount ?? 0
    return empty
  }
}

export type DistinctLecturerRow = {
  lecturer_name: string
  lecturer_key: string
  class_count: number
}

export type TimetableStats = {
  thisWeekCount: number
  thisWeekHours: number
  busiestDay: { dayOfWeek: number; count: number } | null
  lastImportedAt: string | null
  totalEntries: number
}

export const TimetableAdapter = new TimetableAdapterImpl()
