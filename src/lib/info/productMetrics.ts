/**
 * Optional pilot measurement, stored on this browser only. No identifiers, URLs,
 * searches, questions, account data or automatic network transmission.
 */
import { dayKeyDiff, warsawDayKey } from './time'

export const PILOT_METRICS_KEY = 'ujverse.pilotMetrics.v1'
const TASK_KEY = 'ujverse.pilotTask.v1'
export const PILOT_RETENTION_DAYS = 28
export const PILOT_TASKS = {
  registration: 'Znajdź termin rejestracji i otwórz oficjalne źródło',
  scholarship: 'Znajdź instrukcję stypendialną i otwórz oficjalne źródło',
  event: 'Znajdź wydarzenie i otwórz stronę organizatora',
} as const
export type PilotTask = keyof typeof PILOT_TASKS
export const PILOT_SOURCE_KINDS = [
  'registration',
  'announcement',
  'event',
  'guide',
  'tool',
  'radar',
] as const
export type PilotSourceKind = (typeof PILOT_SOURCE_KINDS)[number]
const TASK_SOURCE_KIND: Record<PilotTask, PilotSourceKind> = {
  registration: 'registration',
  scholarship: 'guide',
  event: 'event',
}
export type PilotTaskResult = {
  task: PilotTask
  day: string
  secondsToSource: number
  sourceKind: PilotSourceKind
}
export type PilotMetrics = {
  version: 1
  consentedDay: string
  visitDays: string[]
  sourceOpens: Partial<Record<PilotSourceKind, number>>
  tasksStarted: number
  taskResults: PilotTaskResult[]
}
type PendingTask = { task: PilotTask; startedAt: number }
const listeners = new Set<() => void>()
let memoryValue: string | null = null
let pendingMemory: PendingTask | null = null

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}
function isTask(value: unknown): value is PilotTask {
  return typeof value === 'string' && Object.hasOwn(PILOT_TASKS, value)
}

/** Strictly allowlisted parsing also strips any foreign/old sensitive fields. */
export function parsePilotMetrics(
  raw: string | null,
  now = new Date(),
): PilotMetrics | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const data = value as Record<string, unknown>
    if (data.version !== 1 || !isDay(data.consentedDay)) return null
    const age = dayKeyDiff(data.consentedDay, warsawDayKey(now))
    if (age < 0 || age >= PILOT_RETENTION_DAYS) return null
    const validDay = (day: unknown): day is string =>
      isDay(day) &&
      dayKeyDiff(data.consentedDay as string, day) >= 0 &&
      dayKeyDiff(day, warsawDayKey(now)) >= 0
    const visitDays = Array.isArray(data.visitDays)
      ? [...new Set(data.visitDays.filter(validDay))]
          .sort()
          .slice(-PILOT_RETENTION_DAYS)
      : []
    const sourceOpens: PilotMetrics['sourceOpens'] = {}
    if (data.sourceOpens && typeof data.sourceOpens === 'object') {
      const counts = data.sourceOpens as Record<string, unknown>
      for (const kind of PILOT_SOURCE_KINDS) {
        const count = counts[kind]
        if (
          typeof count === 'number' &&
          Number.isInteger(count) &&
          count >= 0 &&
          count <= 10000
        )
          sourceOpens[kind] = count
      }
    }
    const taskResults: PilotTaskResult[] = []
    if (Array.isArray(data.taskResults))
      for (const entry of data.taskResults.slice(-50)) {
        if (!entry || typeof entry !== 'object') continue
        const result = entry as Record<string, unknown>
        if (
          isTask(result.task) &&
          validDay(result.day) &&
          result.sourceKind === TASK_SOURCE_KIND[result.task] &&
          typeof result.secondsToSource === 'number' &&
          Number.isInteger(result.secondsToSource) &&
          result.secondsToSource >= 0 &&
          result.secondsToSource <= 1800
        ) {
          taskResults.push({
            task: result.task,
            day: result.day,
            secondsToSource: result.secondsToSource,
            sourceKind: result.sourceKind as PilotSourceKind,
          })
        }
      }
    const tasksStarted =
      typeof data.tasksStarted === 'number' &&
      Number.isInteger(data.tasksStarted) &&
      data.tasksStarted >= taskResults.length &&
      data.tasksStarted <= 50
        ? data.tasksStarted
        : taskResults.length
    return {
      version: 1,
      consentedDay: data.consentedDay,
      visitDays,
      sourceOpens,
      tasksStarted,
      taskResults,
    }
  } catch {
    return null
  }
}

function rawSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PILOT_METRICS_KEY)
  } catch {
    return memoryValue
  }
}
function persist(data: PilotMetrics | null) {
  if (typeof window === 'undefined') return
  memoryValue = data ? JSON.stringify(data) : null
  try {
    if (memoryValue) window.localStorage.setItem(PILOT_METRICS_KEY, memoryValue)
    else window.localStorage.removeItem(PILOT_METRICS_KEY)
  } catch {
    /* Storage-blocked browsers retain the opt-in in this page's memory. */
  }
  for (const listener of listeners) listener()
}
export function getPilotMetricsSnapshot(): string | null {
  const raw = rawSnapshot()
  if (raw && !parsePilotMetrics(raw)) {
    memoryValue = null
    try {
      window.localStorage.removeItem(PILOT_METRICS_KEY)
    } catch {
      /* optional */
    }
    return null
  }
  return raw
}
export function subscribePilotMetrics(listener: () => void): () => void {
  listeners.add(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === PILOT_METRICS_KEY || event.key === null) {
      memoryValue = event.newValue
      // Consent and pending tasks must be erased together in every open tab.
      if (event.newValue === null) clearPendingTask()
      listener()
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', sync)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined')
      window.removeEventListener('storage', sync)
  }
}
export function readPilotMetrics(now = new Date()): PilotMetrics | null {
  return parsePilotMetrics(rawSnapshot(), now)
}
function clearPendingTask() {
  pendingMemory = null
  try {
    window.sessionStorage.removeItem(TASK_KEY)
  } catch {
    /* optional */
  }
}
export function setPilotParticipation(enabled: boolean, now = new Date()) {
  clearPendingTask()
  const day = warsawDayKey(now)
  persist(
    enabled
      ? {
          version: 1,
          consentedDay: day,
          visitDays: [day],
          sourceOpens: {},
          tasksStarted: 0,
          taskResults: [],
        }
      : null,
  )
}
/** Call on public-page entry. A day is recorded at most once, not a visit/session. */
export function recordPilotVisit(now = new Date()) {
  const data = readPilotMetrics(now)
  const day = warsawDayKey(now)
  if (data && !data.visitDays.includes(day))
    persist({ ...data, visitDays: [...data.visitDays, day].sort() })
}
export function startPilotTask(task: PilotTask, now = new Date()): boolean {
  const data = readPilotMetrics(now)
  if (!isTask(task) || !data || data.tasksStarted >= 50) return false
  persist({ ...data, tasksStarted: data.tasksStarted + 1 })
  pendingMemory = { task, startedAt: now.getTime() }
  try {
    window.sessionStorage.setItem(TASK_KEY, JSON.stringify(pendingMemory))
  } catch {
    /* optional */
  }
  return true
}
function pendingTask(): PendingTask | null {
  try {
    const raw = window.sessionStorage.getItem(TASK_KEY)
    if (raw) {
      const value = JSON.parse(raw) as Partial<PendingTask>
      if (
        isTask(value.task) &&
        typeof value.startedAt === 'number' &&
        Number.isFinite(value.startedAt)
      )
        return { task: value.task, startedAt: value.startedAt }
    }
  } catch {
    /* optional */
  }
  return pendingMemory
}
/**
 * Record only an actual source-link activation, never internal navigation.
 * Scholarship tasks require context supplied by the scholarship guide itself.
 */
export function recordUsefulSourceOpen(
  kind: PilotSourceKind,
  options?: { task?: PilotTask; now?: Date },
) {
  const now = options?.now ?? new Date()
  if (!PILOT_SOURCE_KINDS.includes(kind)) return
  const data = readPilotMetrics(now)
  if (!data) return
  const pending = pendingTask()
  const elapsed = pending
    ? Math.ceil((now.getTime() - pending.startedAt) / 1000)
    : -1
  // Category is only a necessary match. The researcher still verifies that the
  // selected source answers the assigned question and that the student understood it.
  const matchesTask =
    pending &&
    kind === TASK_SOURCE_KIND[pending.task] &&
    (pending.task !== 'scholarship' || options?.task === 'scholarship')
  const result =
    pending &&
    matchesTask &&
    data.tasksStarted > data.taskResults.length &&
    elapsed >= 0 &&
    elapsed <= 1800
      ? {
          task: pending.task,
          day: warsawDayKey(now),
          secondsToSource: elapsed,
          sourceKind: kind,
        }
      : null
  if (pending && matchesTask && (result || elapsed < 0 || elapsed > 1800))
    clearPendingTask()
  persist({
    ...data,
    sourceOpens: {
      ...data.sourceOpens,
      [kind]: Math.min(10000, (data.sourceOpens[kind] ?? 0) + 1),
    },
    taskResults: result
      ? [...data.taskResults, result].slice(-50)
      : data.taskResults,
  })
}
export function summarizePilotMetrics(data: PilotMetrics, now = new Date()) {
  const ageDays = dayKeyDiff(data.consentedDay, warsawDayKey(now))
  const sourceOpens = Object.values(data.sourceOpens).reduce(
    (sum, count) => sum + (count ?? 0),
    0,
  )
  return {
    activeDays: data.visitDays.length,
    sourceOpens,
    tasksStarted: data.tasksStarted,
    attemptedTasksWithSource: data.taskResults.length,
    tasksWithSourceWithinMinute: data.taskResults.filter(
      (result) => result.secondsToSource <= 60,
    ).length,
    weekObservationComplete: ageDays >= 7,
    returnedWithin7Days: data.visitDays.some((day) => {
      const d = dayKeyDiff(data.consentedDay, day)
      return d >= 1 && d <= 7
    }),
    afterWeekObservationComplete: ageDays >= 13,
    returnedDays7To13: data.visitDays.some((day) => {
      const d = dayKeyDiff(data.consentedDay, day)
      return d >= 7 && d <= 13
    }),
  }
}

/** The participant chooses whether to share this allowlisted, device-only report. */
export function exportPilotMetrics(now = new Date()): string | null {
  const data = readPilotMetrics(now)
  return data
    ? JSON.stringify(
        {
          ...data,
          summary: summarizePilotMetrics(data, now),
          scope: 'one-browser-device',
          automaticTransmission: false,
        },
        null,
        2,
      )
    : null
}
