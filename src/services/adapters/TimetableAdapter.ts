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
