/**
 * UJverse — adapter kalendarza akademickiego.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Operacje:
 *   - `listForRange(params)`  — RPC `calendar_search` (jeden round-trip,
 *                                indeks GiST trafia w `time_range && range`).
 *   - `subscribe(onChange)`   — Realtime na `calendar_entries`; UI dostaje
 *                                tylko sygnał „coś się zmieniło" → robi
 *                                refetch dla aktualnego zakresu (taniej niż
 *                                inkrementalny merge przy 9 kindach z
 *                                rożnymi sourcami).
 *
 * Świadomie BEZ CRUD-u: tabela `calendar_entries` w v1 nie ma polityk
 * INSERT/UPDATE/DELETE dla `authenticated`. Pisanie idzie wyłącznie
 * przez triggery DB i scraper (service_role). Próba INSERT z UI zwróci
 * 403 z PostgREST — zostawiamy to świadomie.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import {
  isCalendarEntry,
  type CalendarEntry,
  type CalendarSearchParams,
} from '../../types/calendar'
import type { Unsubscribe } from './BaseAdapter'

/** Lustrzane odbicie parametrów RPC `public.calendar_search`. */
type CalendarSearchRpcArgs = {
  p_range_start: string
  p_range_end: string
  p_kinds: string[] | null
  p_lecturer_keys: string[] | null
  p_departments: string[] | null
  p_limit: number
}

function buildRpcArgs(params: CalendarSearchParams): CalendarSearchRpcArgs {
  const kinds = params.filters?.kinds
  const lecturerKeys = params.filters?.lecturerKeys
  const departments = params.filters?.departments
  return {
    p_range_start: params.rangeStart.toISOString(),
    p_range_end: params.rangeEnd.toISOString(),
    p_kinds: kinds && kinds.length > 0 ? [...kinds] : null,
    p_lecturer_keys: lecturerKeys && lecturerKeys.length > 0 ? [...lecturerKeys] : null,
    p_departments: departments && departments.length > 0 ? [...departments] : null,
    p_limit: Math.max(1, Math.min(2000, params.limit ?? 500)),
  }
}

class CalendarAdapterImpl {
  /**
   * Wpisy w zakresie [rangeStart, rangeEnd] (inclusive po obu stronach,
   * tak jak `tstzrange(..., '[]')` po stronie SQL).
   *
   * Sanitizujemy każdy rekord przez `isCalendarEntry` przed wpuszczeniem
   * do stanu — RPC zwraca `unknown` po deserializacji.
   */
  async listForRange(params: CalendarSearchParams): Promise<CalendarEntry[]> {
    const args = buildRpcArgs(params)
    const { data, error } = await supabase.rpc('calendar_search', args)
    if (error) {
      console.warn('[CalendarAdapter] listForRange RPC error', error.message)
      return []
    }
    if (!Array.isArray(data)) return []
    const out: CalendarEntry[] = []
    for (const row of data) {
      if (isCalendarEntry(row)) out.push(row)
    }
    return out
  }

  /**
   * Realtime na całej tabeli — wzorzec „bezdanowy sygnał" jak
   * `AnnouncementsAdapter.subscribe`. Hook robi refetch dla aktualnego
   * zakresu, bo:
   *   - 9 kindów × kilka sourców = trudny merge,
   *   - widok miesiąca i tak rzadko ma >200 wpisów,
   *   - refetch trafia w GiST indeks → milisekundy.
   */
  subscribe(onChange: () => void): Unsubscribe {
    const channel: RealtimeChannel = supabase
      .channel('calendar-entries-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_entries' },
        () => onChange(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }
}

export const CalendarAdapter = new CalendarAdapterImpl()
