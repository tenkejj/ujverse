/**
 * UJverse — hook „Co dziś masz?": dzisiejsze zajęcia + cross-ref z anonsami.
 *
 * Źródło danych: RPC `get_timetable_for_range` (LATERAL match do anonsów
 * o odwołaniach w oknie N godzin). Klient odświeża:
 *   - przy zmianie `userId` (login/logout),
 *   - po INSERT na `public.announcements` (real-time — nowa cancelled może
 *     dotyczyć dzisiejszych zajęć),
 *   - co 60 s tickerem do liczenia „next class in 15 min".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataService } from '../services/DataService'
import { supabase } from '../supabaseClient'
import type { TimetableEntryRow } from '../services/adapters/TimetableAdapter'

export type TodayClass = TimetableEntryRow & {
  startDate: Date
  endDate: Date
  isCancelled: boolean
  /** -1 = już skończone, 0 = w trakcie, >0 = za N minut. */
  startsInMinutes: number
}

type Params = {
  userId: string | null
  /** Override dla testowania — domyślnie `now`. */
  now?: Date
  /** Okno na anonse (godziny wstecz). Default 7 dni = 168h. */
  announcementWindowHours?: number
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function decorate(row: TimetableEntryRow, now: Date): TodayClass {
  const start = new Date(row.start_time)
  const end = new Date(row.end_time)
  const diffMs = start.getTime() - now.getTime()
  const startsInMinutes =
    end.getTime() < now.getTime()
      ? -1
      : start.getTime() <= now.getTime()
        ? 0
        : Math.max(1, Math.round(diffMs / 60_000))
  return {
    ...row,
    startDate: start,
    endDate: end,
    isCancelled: Boolean(row.cancelled_announcement_id),
    startsInMinutes,
  }
}

export type UseTodayClassesResult = {
  classes: TodayClass[]
  loading: boolean
  nextClass: TodayClass | null
  refresh: () => Promise<void>
  /** Liczba zajęć anulowanych dziś — do badge w nawigacji. */
  cancelledTodayCount: number
}

export function useTodayClasses({
  userId,
  now: nowOverride,
  announcementWindowHours = 168,
}: Params): UseTodayClassesResult {
  const [rows, setRows] = useState<TimetableEntryRow[]>([])
  const [loading, setLoading] = useState(false)
  // Tickujący `now` co 60 s — przeliczamy `startsInMinutes` bez refetcha DB.
  const [tickNow, setTickNow] = useState<Date>(() => nowOverride ?? new Date())
  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([])
      return
    }
    setLoading(true)
    const base = nowOverride ?? new Date()
    const from = startOfLocalDay(base)
    const to = endOfLocalDay(base)
    const data = await DataService.listTimetableForRange(from, to, announcementWindowHours)
    setLoading(false)
    if (userIdRef.current !== userId) return
    setRows(data)
  }, [announcementWindowHours, nowOverride, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Tick co 60 s. Czyścimy interwał przy zmianie usera / unmount.
  useEffect(() => {
    if (nowOverride) return
    const id = window.setInterval(() => setTickNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [nowOverride])

  // Real-time: nowy anons → refetch (LATERAL w RPC dopiąża świeżą cancelled).
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`today-classes-announcements-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        () => {
          void refresh()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, userId])

  const classes = useMemo(() => {
    const now = nowOverride ?? tickNow
    return rows.map((r) => decorate(r, now))
  }, [nowOverride, rows, tickNow])

  const nextClass = useMemo(() => {
    return classes.find((c) => c.startsInMinutes >= 0 && !c.isCancelled) ?? null
  }, [classes])

  const cancelledTodayCount = useMemo(
    () => classes.filter((c) => c.isCancelled).length,
    [classes],
  )

  return { classes, loading, nextClass, refresh, cancelledTodayCount }
}
