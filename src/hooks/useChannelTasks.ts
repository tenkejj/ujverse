/**
 * UJverse — useChannelTasks: zadania/deadlines per sala.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzorzec analogiczny do `useCohortPolls`:
 *   - initial fetch (`listTasksForChannel` + `getCompletionsForTasks`)
 *   - Realtime subscribe (jeden channel `aula-tasks-<cohortId>`,
 *     2 listenery: tasks + completions)
 *   - aggregate `CohortTaskAggregate { task, completionsCount,
 *     completionUserIds, myCompletedAt }` per taskId
 *   - optimistic toggle (toggleMyCompletion) z rollback ze snapshotu
 *   - smart sort: open tasks (po due_at ASC z NULLS LAST), potem
 *     completed (po completed_at DESC, capped 50)
 *
 * Hook re-fetchuje na zmianę `(cohortId, channelId)`. Sala główna =
 * `channelId === null`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type {
  CohortChannelTask,
  CohortTaskAggregate,
  CohortTaskCompletion,
  TaskPriority,
} from '../types/database'

type TasksState = Map<number, CohortTaskAggregate>

type Params = {
  cohortId: string | null
  channelId: number | null
  currentUserId: string | null
}

function buildAggregate(
  task: CohortChannelTask,
  completions: CohortTaskCompletion[],
  currentUserId: string | null,
): CohortTaskAggregate {
  const completionUserIds: string[] = []
  let myCompletedAt: string | null = null
  for (const c of completions) {
    completionUserIds.push(c.user_id)
    if (currentUserId && c.user_id === currentUserId) myCompletedAt = c.completed_at
  }
  return {
    task,
    completionsCount: completions.length,
    completionUserIds,
    myCompletedAt,
  }
}

function applyCompletion(
  agg: CohortTaskAggregate,
  userId: string,
  completedAt: string,
  isCurrentUser: boolean,
): CohortTaskAggregate {
  if (agg.completionUserIds.includes(userId)) return agg
  return {
    task: agg.task,
    completionsCount: agg.completionsCount + 1,
    completionUserIds: [...agg.completionUserIds, userId],
    myCompletedAt: isCurrentUser ? completedAt : agg.myCompletedAt,
  }
}

function removeCompletion(
  agg: CohortTaskAggregate,
  userId: string,
  isCurrentUser: boolean,
): CohortTaskAggregate {
  if (!agg.completionUserIds.includes(userId)) return agg
  return {
    task: agg.task,
    completionsCount: Math.max(0, agg.completionsCount - 1),
    completionUserIds: agg.completionUserIds.filter((u) => u !== userId),
    myCompletedAt: isCurrentUser ? null : agg.myCompletedAt,
  }
}

/**
 * Smart sort dla widoku:
 *   - open tasks first (completed_at IS NULL)
 *     - po due_at ASC (NULLS LAST)
 *     - tiebreak po priority (high → normal → low)
 *     - tiebreak po created_at DESC (najnowsze pierwsze)
 *   - completed tasks last (completed_at != NULL), po completed_at DESC
 */
const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 }

function sortAggregates(items: CohortTaskAggregate[]): CohortTaskAggregate[] {
  return items.slice().sort((a, b) => {
    const aClosed = a.task.completed_at != null
    const bClosed = b.task.completed_at != null
    if (aClosed !== bClosed) return aClosed ? 1 : -1

    if (!aClosed) {
      // Open: due_at ASC NULLS LAST
      const aDue = a.task.due_at ? new Date(a.task.due_at).getTime() : Infinity
      const bDue = b.task.due_at ? new Date(b.task.due_at).getTime() : Infinity
      if (aDue !== bDue) return aDue - bDue
      const aPr = PRIORITY_RANK[a.task.priority] ?? 1
      const bPr = PRIORITY_RANK[b.task.priority] ?? 1
      if (aPr !== bPr) return aPr - bPr
      return new Date(b.task.created_at).getTime() - new Date(a.task.created_at).getTime()
    }
    // Closed: completed_at DESC
    return (
      new Date(b.task.completed_at as string).getTime() -
      new Date(a.task.completed_at as string).getTime()
    )
  })
}

export function useChannelTasks({ cohortId, channelId, currentUserId }: Params) {
  const [tasksMap, setTasksMap] = useState<TasksState>(() => new Map())
  const stateRef = useRef<TasksState>(new Map())

  useEffect(() => {
    stateRef.current = tasksMap
  }, [tasksMap])

  useEffect(() => {
    if (!cohortId) {
      setTasksMap(new Map())
      stateRef.current = new Map()
      return
    }

    let cancelled = false

    void (async () => {
      const { data: tasks, error } = await CohortService.listTasksForChannel(cohortId, channelId)
      if (cancelled || error) return
      if (tasks.length === 0) {
        setTasksMap(new Map())
        stateRef.current = new Map()
        return
      }

      const ids = tasks.map((t) => t.id)
      const { data: completions, error: cerr } = await CohortService.getCompletionsForTasks(ids)
      if (cancelled || cerr) return

      const byTask = new Map<number, CohortTaskCompletion[]>()
      for (const c of completions) {
        const bucket = byTask.get(c.task_id) ?? []
        bucket.push(c)
        byTask.set(c.task_id, bucket)
      }

      const fresh: TasksState = new Map()
      for (const t of tasks) {
        fresh.set(t.id, buildAggregate(t, byTask.get(t.id) ?? [], currentUserId))
      }
      stateRef.current = fresh
      setTasksMap(fresh)
    })()

    const channel = CohortService.subscribeToTasks(cohortId, {
      onTaskInsert: (row) => {
        // Filter na aktywny channel (subscribe jest cohort-scoped — UI Sali
        // głównej widzi tylko channel_id IS NULL i analogicznie).
        const sameChannel =
          (row.channel_id == null && channelId == null) ||
          (row.channel_id != null && channelId != null && row.channel_id === channelId)
        if (!sameChannel) return
        const next = new Map(stateRef.current)
        next.set(row.id, buildAggregate(row, [], currentUserId))
        stateRef.current = next
        setTasksMap(next)
      },
      onTaskUpdate: (row) => {
        const existing = stateRef.current.get(row.id)
        if (!existing) return
        const next = new Map(stateRef.current)
        next.set(row.id, { ...existing, task: row })
        stateRef.current = next
        setTasksMap(next)
      },
      onTaskDelete: (row) => {
        if (!stateRef.current.has(row.id)) return
        const next = new Map(stateRef.current)
        next.delete(row.id)
        stateRef.current = next
        setTasksMap(next)
      },
      onCompletionInsert: (row) => {
        const existing = stateRef.current.get(row.task_id)
        if (!existing) return
        const isMe = currentUserId != null && row.user_id === currentUserId
        const updated = applyCompletion(existing, row.user_id, row.completed_at, isMe)
        if (updated === existing) return
        const next = new Map(stateRef.current)
        next.set(row.task_id, updated)
        stateRef.current = next
        setTasksMap(next)
      },
      onCompletionDelete: (row) => {
        const existing = stateRef.current.get(row.task_id)
        if (!existing) return
        const isMe = currentUserId != null && row.user_id === currentUserId
        const updated = removeCompletion(existing, row.user_id, isMe)
        if (updated === existing) return
        const next = new Map(stateRef.current)
        next.set(row.task_id, updated)
        stateRef.current = next
        setTasksMap(next)
      },
    })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [cohortId, channelId, currentUserId])

  const sortedTasks = useMemo(() => sortAggregates(Array.from(tasksMap.values())), [tasksMap])

  const createTask = useCallback(
    async (input: {
      title: string
      description: string | null
      dueAt: string | null
      priority: TaskPriority
    }) => {
      if (!cohortId || !currentUserId) {
        toast.error('Musisz być zalogowany żeby dodać zadanie.')
        return
      }
      const { error } = await CohortService.createTask({
        cohortId,
        channelId,
        createdBy: currentUserId,
        title: input.title,
        description: input.description,
        dueAt: input.dueAt,
        priority: input.priority,
      })
      if (error) {
        toast.error('Nie udało się utworzyć zadania.')
      }
    },
    [cohortId, channelId, currentUserId],
  )

  const deleteTask = useCallback(async (taskId: number) => {
    const existing = stateRef.current.get(taskId)
    if (!existing) return
    // Optimistic remove.
    const next = new Map(stateRef.current)
    next.delete(taskId)
    stateRef.current = next
    setTasksMap(next)

    const { error } = await CohortService.deleteTask(taskId)
    if (error) {
      // Rollback.
      const rollback = new Map(stateRef.current)
      rollback.set(taskId, existing)
      stateRef.current = rollback
      setTasksMap(rollback)
      toast.error('Nie udało się usunąć zadania.')
    }
  }, [])

  const toggleMyCompletion = useCallback(
    async (taskId: number) => {
      if (!currentUserId) {
        toast.error('Musisz być zalogowany.')
        return
      }
      const existing = stateRef.current.get(taskId)
      if (!existing) return

      const wasCompleted = existing.myCompletedAt != null
      // Optimistic toggle.
      const optimistic = wasCompleted
        ? removeCompletion(existing, currentUserId, true)
        : applyCompletion(existing, currentUserId, new Date().toISOString(), true)

      if (optimistic !== existing) {
        const next = new Map(stateRef.current)
        next.set(taskId, optimistic)
        stateRef.current = next
        setTasksMap(next)
      }

      const { error } = await CohortService.toggleMyTaskCompletion(taskId)
      if (error) {
        const rollback = new Map(stateRef.current)
        rollback.set(taskId, existing)
        stateRef.current = rollback
        setTasksMap(rollback)
        toast.error('Nie udało się zapisać statusu.')
      }
    },
    [currentUserId],
  )

  const toggleGlobalDone = useCallback(async (taskId: number) => {
    const existing = stateRef.current.get(taskId)
    if (!existing) return

    const wasClosed = existing.task.completed_at != null
    const optimistic: CohortTaskAggregate = {
      ...existing,
      task: {
        ...existing.task,
        completed_at: wasClosed ? null : new Date().toISOString(),
        completed_by: wasClosed ? null : (currentUserId ?? null),
      },
    }
    const next = new Map(stateRef.current)
    next.set(taskId, optimistic)
    stateRef.current = next
    setTasksMap(next)

    const { error } = await CohortService.toggleGlobalTaskDone(taskId)
    if (error) {
      const rollback = new Map(stateRef.current)
      rollback.set(taskId, existing)
      stateRef.current = rollback
      setTasksMap(rollback)
      toast.error('Nie udało się zmienić statusu zadania.')
    }
  }, [currentUserId])

  return useMemo(
    () => ({
      tasks: sortedTasks,
      createTask,
      deleteTask,
      toggleMyCompletion,
      toggleGlobalDone,
    }),
    [sortedTasks, createTask, deleteTask, toggleMyCompletion, toggleGlobalDone],
  )
}
