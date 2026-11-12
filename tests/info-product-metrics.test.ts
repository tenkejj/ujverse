import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  exportPilotMetrics,
  parsePilotMetrics,
  PILOT_METRICS_KEY,
  readPilotMetrics,
  recordPilotVisit,
  recordUsefulSourceOpen,
  setPilotParticipation,
  startPilotTask,
  subscribePilotMetrics,
  summarizePilotMetrics,
} from '../src/lib/info/productMetrics.ts'

const NOW = new Date('2026-11-11T12:00:00Z')
const after = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)
function withBrowser(
  run: (
    storage: Map<string, string>,
    emitStorage: (event: Partial<StorageEvent>) => void,
  ) => void,
) {
  const storage = new Map<string, string>()
  const session = new Map<string, string>()
  const listeners = new Set<(event: StorageEvent) => void>()
  const adapter = (data: Map<string, string>) => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: adapter(storage),
      sessionStorage: adapter(session),
      addEventListener: (_: string, listener: (event: StorageEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: (event: StorageEvent) => void) =>
        listeners.delete(listener),
    },
  })
  try {
    run(storage, (event) => {
      for (const listener of listeners) listener(event as StorageEvent)
    })
  } finally {
    setPilotParticipation(false)
    Reflect.deleteProperty(globalThis, 'window')
  }
}

describe('optional device-only product measurement', () => {
  it('does not write events without explicit opt-in', () =>
    withBrowser((storage) => {
      recordPilotVisit(NOW)
      recordUsefulSourceOpen('registration', { now: NOW })
      assert.equal(startPilotTask('registration', NOW), false)
      assert.equal(storage.size, 0)
      assert.equal(exportPilotMetrics(NOW), null)
    }))

  it('keeps the task pending after an unrelated source and completes only once', () =>
    withBrowser(() => {
      setPilotParticipation(true, NOW)
      assert.equal(startPilotTask('registration', NOW), true)
      recordUsefulSourceOpen('event', { now: after(10) })
      assert.equal(readPilotMetrics(after(10))?.taskResults.length, 0)
      recordUsefulSourceOpen('registration', { now: after(40) })
      recordUsefulSourceOpen('registration', { now: after(50) })
      const data = readPilotMetrics(after(50))!
      assert.equal(data.tasksStarted, 1)
      assert.equal(data.taskResults.length, 1)
      assert.equal(data.taskResults[0]?.secondsToSource, 40)
      assert.equal(data.sourceOpens.event, 1)
      assert.equal(
        summarizePilotMetrics(data, after(50)).tasksWithSourceWithinMinute,
        1,
      )
    }))

  it('requires scholarship context instead of treating any guide as its source', () =>
    withBrowser(() => {
      setPilotParticipation(true, NOW)
      startPilotTask('scholarship', NOW)
      recordUsefulSourceOpen('guide', { now: after(5) })
      recordUsefulSourceOpen('guide', { now: after(10), task: 'registration' })
      assert.equal(readPilotMetrics(after(10))?.taskResults.length, 0)
      recordUsefulSourceOpen('event', { now: after(15), task: 'scholarship' })
      assert.equal(readPilotMetrics(after(15))?.taskResults.length, 0)
      recordUsefulSourceOpen('guide', { now: after(65), task: 'scholarship' })
      const data = readPilotMetrics(after(65))!
      assert.equal(data.taskResults[0]?.secondsToSource, 65)
      assert.equal(data.sourceOpens.guide, 3)
      assert.equal(data.sourceOpens.event, 1)
      assert.equal(
        summarizePilotMetrics(data, after(65)).tasksWithSourceWithinMinute,
        0,
      )
    }))

  it('requires an event source for the event task', () =>
    withBrowser(() => {
      setPilotParticipation(true, NOW)
      startPilotTask('event', NOW)
      recordUsefulSourceOpen('registration', { now: after(5) })
      recordUsefulSourceOpen('guide', { now: after(10), task: 'scholarship' })
      assert.equal(readPilotMetrics(after(10))?.taskResults.length, 0)
      recordUsefulSourceOpen('event', { now: after(20) })
      assert.deepEqual(readPilotMetrics(after(20))?.taskResults, [
        {
          task: 'event',
          day: '2026-11-11',
          secondsToSource: 20,
          sourceKind: 'event',
        },
      ])
    }))

  it('does not count a source reached after the task time limit as task success', () =>
    withBrowser(() => {
      setPilotParticipation(true, NOW)
      startPilotTask('event', NOW)
      recordUsefulSourceOpen('event', { now: after(1801) })
      const data = readPilotMetrics(after(1801))!
      assert.equal(data.taskResults.length, 0)
      assert.equal(data.sourceOpens.event, 1)
    }))

  it('deduplicates visits by Warsaw day and keeps return-window denominators explicit', () =>
    withBrowser(() => {
      setPilotParticipation(true, NOW)
      recordPilotVisit(after(10))
      recordPilotVisit(new Date('2026-11-18T12:00:00Z'))
      const data = readPilotMetrics(new Date('2026-11-18T12:00:00Z'))!
      assert.deepEqual(data.visitDays, ['2026-11-11', '2026-11-18'])
      const firstDay = summarizePilotMetrics(data, NOW)
      assert.equal(firstDay.weekObservationComplete, false)
      const week = summarizePilotMetrics(data, new Date('2026-11-18T12:00:00Z'))
      assert.equal(week.weekObservationComplete, true)
      assert.equal(week.returnedWithin7Days, true)
      assert.equal(week.afterWeekObservationComplete, false)
      assert.equal(week.returnedDays7To13, true)
    }))

  it('strips foreign identifying fields and expires after 28 civil days', () => {
    const raw = JSON.stringify({
      version: 1,
      consentedDay: '2026-11-11',
      visitDays: ['2026-11-11', '2026-02-31'],
      sourceOpens: { event: 2, personalQuestion: 'secret' },
      tasksStarted: 0,
      taskResults: [],
      userId: 'private',
      query: 'private',
    })
    const parsed = parsePilotMetrics(raw, NOW)!
    assert.equal(JSON.stringify(parsed).includes('private'), false)
    assert.deepEqual(parsed.visitDays, ['2026-11-11'])
    assert.deepEqual(parsed.sourceOpens, { event: 2 })
    assert.equal(parsePilotMetrics(raw, new Date('2026-12-09T12:00:00Z')), null)
  })

  it('discards historical task results from mismatched source categories', () => {
    const raw = JSON.stringify({
      version: 1,
      consentedDay: '2026-11-11',
      visitDays: ['2026-11-11'],
      sourceOpens: { event: 1 },
      tasksStarted: 1,
      taskResults: [
        {
          task: 'registration',
          day: '2026-11-11',
          secondsToSource: 10,
          sourceKind: 'event',
        },
      ],
    })
    const data = parsePilotMetrics(raw, NOW)!
    assert.equal(data.taskResults.length, 0)
    assert.equal(data.tasksStarted, 1)
    assert.equal(data.sourceOpens.event, 1)
  })

  it('erases pending tasks when another tab withdraws consent', () =>
    withBrowser((storage, emitStorage) => {
      setPilotParticipation(true, NOW)
      startPilotTask('registration', NOW)
      const newObservation = readPilotMetrics(NOW)!
      const unsubscribe = subscribePilotMetrics(() => {})
      try {
        storage.delete(PILOT_METRICS_KEY)
        emitStorage({ key: PILOT_METRICS_KEY, newValue: null })
        // Another tab opts in again and starts its own new task.
        storage.set(PILOT_METRICS_KEY, JSON.stringify(newObservation))
        recordUsefulSourceOpen('registration', { now: after(20) })
        assert.equal(readPilotMetrics(after(20))?.taskResults.length, 0)
      } finally {
        unsubscribe()
      }
    }))

  it('opt-out deletes local measurement and any pending task', () =>
    withBrowser((storage) => {
      setPilotParticipation(true, NOW)
      startPilotTask('event', NOW)
      setPilotParticipation(false, NOW)
      recordUsefulSourceOpen('event', { now: after(20) })
      assert.equal(storage.has(PILOT_METRICS_KEY), false)
      assert.equal(readPilotMetrics(after(20)), null)
    }))
})
