/**
 * UJverse — TaskPriorityPill: meta + UI pigułka dla `TaskPriority`.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import type { TaskPriority } from '../../types/database'

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const satisfies readonly TaskPriority[]

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; tint: string; text: string; rank: number }
> = {
  low: {
    label: 'low',
    tint: 'bg-zinc-200/70 dark:bg-white/[0.06]',
    text: 'text-zinc-600 dark:text-zinc-300',
    rank: 2,
  },
  normal: {
    label: 'normal',
    tint: 'bg-sky-500/15 dark:bg-sky-400/15',
    text: 'text-sky-700 dark:text-sky-300',
    rank: 1,
  },
  high: {
    label: 'high',
    tint: 'bg-rose-500/15 dark:bg-rose-400/15',
    text: 'text-rose-700 dark:text-rose-300',
    rank: 0,
  },
}

type Props = {
  priority: TaskPriority
  className?: string
}

export default function TaskPriorityPill({ priority, className }: Props) {
  const meta = TASK_PRIORITY_META[priority]
  return (
    <span
      title={`Priorytet: ${meta.label}`}
      className={[
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        meta.tint,
        meta.text,
        className ?? '',
      ].join(' ')}
    >
      {meta.label}
    </span>
  )
}
