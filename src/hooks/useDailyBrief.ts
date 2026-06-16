/**
 * UJverse — useDailyBrief: agregator danych dla widoku `/dzis`.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Zbiera w jeden snapshot:
 *   - dzisiejsze zajęcia (`useTodayClasses` — z anulacjami via LATERAL join
 *     w RPC do `announcements`)
 *   - najbliższe deadliney user'a w Aula (`CohortService.listOpenTasksForCohort`
 *     — z odfiltrowanym per-user completion)
 *   - najświeższe ogłoszenia (`AnnouncementsAdapter.fetch` → top 10 w 48h)
 *
 * Dane do AI brief idą przez `toBriefPayload()` — pure function, łatwo
 * testowalna i NIE odpala nowych queries (czysty mapping snapshot → payload).
 *
 * Auto-refresh:
 *   - tick co 60 s (countdown do najbliższych zajęć)
 *   - postgres-changes listenery realtime'owe siedzą w useTodayClasses
 *     (announcements) — nie duplikujemy
 *   - dla tasks: callerowy `refresh()` (np. po focus tab / pull-to-refresh)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTodayClasses, type TodayClass } from './useTodayClasses'
import { CohortService } from '../services/CohortService'
import { AnnouncementsAdapter, type AnnouncementRow } from '../services/adapters/AnnouncementsAdapter'
import type { CohortChannelTask, Cohort } from '../types/database'
import type { Profile } from '../types'
import type {
  BriefAnnouncement,
  BriefTask,
  BriefTimetableEntry,
  DailyBriefInput,
} from '../lib/dailyBriefPrompts'

type Params = {
  userId: string | null
  cohort: Cohort | null
  myProfile: Profile | null
}

export type DailyBriefSnapshot = {
  classes: TodayClass[]
  nextClass: TodayClass | null
  cancelledTodayCount: number
  tasks: CohortChannelTask[]
  /** Map<channelId, label> — używane do wyświetlania "sala xxx" przy taskach. */
  channelLabelsById: Map<number, string>
  announcements: AnnouncementRow[]
  loading: boolean
  refresh: () => Promise<void>
}

export type UseDailyBriefResult = DailyBriefSnapshot & {
  /** Zmapuj snapshot na payload do `/api/daily-brief`. Capujemy do limitów. */
  toBriefPayload: () => DailyBriefInput
}

const ANNOUNCEMENTS_RECENT_HOURS = 48
const MAX_TASKS_FOR_BRIEF = 5
const MAX_ANNOUNCEMENTS_FOR_BRIEF = 10
const MAX_CLASSES_FOR_BRIEF = 8

function firstNameFromProfile(p: Profile | null): string | null {
  if (!p) return null
  const full = (p.full_name ?? '').trim()
  if (full) {
    const first = full.split(/\s+/)[0]
    if (first) return first
  }
  const username = (p.username ?? '').trim()
  return username || null
}

function todayLabel(now: Date): string {
  const s = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function isWithinHours(iso: string, hours: number, now: Date): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return t >= now.getTime() - hours * 3_600_000
}

function classToBrief(c: TodayClass): BriefTimetableEntry {
  return {
    // ICS z USOS daje "Statystyka opisowa (wyk)" w polu `summary` — nie mamy
    // osobnej kolumny `class_kind`, AI sam wyłapie nawias jeśli istotny.
    courseName: c.summary ?? null,
    classKind: null,
    startTime: c.start_time,
    endTime: c.end_time,
    locationLabel: c.location ?? null,
    isCancelled: c.isCancelled,
  }
}

function taskToBrief(
  t: CohortChannelTask,
  channelLabelsById: Map<number, string>,
  now: Date,
): BriefTask {
  const dueMs = t.due_at ? new Date(t.due_at).getTime() : null
  return {
    title: t.title,
    dueAt: t.due_at ?? null,
    priority: (t.priority ?? 'normal') as 'low' | 'normal' | 'high',
    isOverdue: dueMs !== null && dueMs < now.getTime(),
    channelLabel: t.channel_id != null ? channelLabelsById.get(t.channel_id) ?? null : null,
  }
}

function announcementToBrief(a: AnnouncementRow): BriefAnnouncement {
  return {
    lecturerName: a.lecturer_name || null,
    status: a.status,
    body: a.summary ?? a.body,
    createdAt: a.created_at,
    department: a.department,
  }
}

export function useDailyBrief({ userId, cohort, myProfile }: Params): UseDailyBriefResult {
  const today = useTodayClasses({ userId })

  const [tasks, setTasks] = useState<CohortChannelTask[]>([])
  const [channelLabelsById, setChannelLabelsById] = useState<Map<number, string>>(new Map())
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [tick, setTick] = useState<Date>(() => new Date())

  // Tick co 60s — dla isOverdue oraz "Za N minut".
  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const loadTasks = useCallback(async () => {
    if (!userId || !cohort) {
      setTasks([])
      setChannelLabelsById(new Map())
      return
    }
    const [taskRes, chanRes] = await Promise.all([
      CohortService.listOpenTasksForCohort(cohort.id, userId, 50),
      CohortService.getChannels(cohort.id),
    ])
    if (!taskRes.error) {
      setTasks(taskRes.data)
    }
    if (!chanRes.error) {
      const map = new Map<number, string>()
      for (const ch of chanRes.data) {
        map.set(ch.id, ch.name)
      }
      setChannelLabelsById(map)
    }
  }, [cohort, userId])

  const loadAnnouncements = useCallback(async () => {
    try {
      const rows = await AnnouncementsAdapter.fetch({ limit: 40 })
      const now = new Date()
      const recent = rows.filter((r) => isWithinHours(r.created_at, ANNOUNCEMENTS_RECENT_HOURS, now))
      setAnnouncements(recent.slice(0, MAX_ANNOUNCEMENTS_FOR_BRIEF))
    } catch (err) {
      console.warn('[useDailyBrief] announcements fetch failed', err)
      setAnnouncements([])
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoadingExtra(true)
    await Promise.all([loadTasks(), loadAnnouncements(), today.refresh()])
    setLoadingExtra(false)
  }, [loadAnnouncements, loadTasks, today])

  useEffect(() => {
    setLoadingExtra(true)
    void Promise.all([loadTasks(), loadAnnouncements()]).finally(() => {
      setLoadingExtra(false)
    })
  }, [loadAnnouncements, loadTasks])

  const toBriefPayload = useCallback((): DailyBriefInput => {
    const now = tick
    return {
      firstName: firstNameFromProfile(myProfile),
      todayLabel: todayLabel(now),
      classes: today.classes.slice(0, MAX_CLASSES_FOR_BRIEF).map(classToBrief),
      tasks: tasks.slice(0, MAX_TASKS_FOR_BRIEF).map((t) => taskToBrief(t, channelLabelsById, now)),
      announcements: announcements.map(announcementToBrief),
    }
  }, [announcements, channelLabelsById, myProfile, tasks, tick, today.classes])

  return useMemo(
    () => ({
      classes: today.classes,
      nextClass: today.nextClass,
      cancelledTodayCount: today.cancelledTodayCount,
      tasks,
      channelLabelsById,
      announcements,
      loading: today.loading || loadingExtra,
      refresh,
      toBriefPayload,
    }),
    [announcements, channelLabelsById, loadingExtra, refresh, tasks, toBriefPayload, today.cancelledTodayCount, today.classes, today.loading, today.nextClass],
  )
}
