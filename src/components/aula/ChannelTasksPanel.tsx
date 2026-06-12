/**
 * UJverse — ChannelTasksPanel + ChannelTasksSheet: zadania/deadlines per sala.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Desktop: right side aside (`xl:flex w-80`) inline w AulaView, analogicznie
 * do `ChannelNotePanel` (mutually exclusive — toggle ChannelHeader otwiera
 * jedno albo drugie).
 *
 * Mobile/tablet: bottom sheet portal.
 *
 * UX:
 *   - Header z liczbą otwartych zadań + przycisk „Dodaj zadanie"
 *   - Lista zadań pre-sortowana (smart sort z hooka): open by due_at ASC,
 *     potem completed by completed_at DESC
 *   - Każdy task: checkbox „ja zrobiłem" + tytuł + priority pill + due badge
 *     + ikona „delete" gdy creator + counter „N osób zrobiło"
 *   - Globalny „task done" przez click w title gdy ALT/CMD + click (?)
 *     albo prościej: secondary button „Zamknij dla wszystkich" pod taskiem
 *     gdy expanded. Dla MVP — secondary checkbox po prawej.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Lock,
  Plus,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { useChannelTasks } from '../../hooks/useChannelTasks'
import { relativeTime } from '../../lib/utils'
import type { CohortTaskAggregate } from '../../types/database'
import TaskPriorityPill from './TaskPriorityPill'
import TaskCreator from './TaskCreator'

type SharedProps = {
  cohortId: string | null
  channelId: number | null
  channelName: string
  currentUserId: string
  userNames?: Map<string, string>
  onClose: () => void
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Format due-at badge text + tone. Toleruje absent due_at (zwraca null).
 *   - >7 dni do terminu: konkretna data "5 lis 2026"
 *   - 1–7 dni: "Za 3 dni"
 *   - <24h: "Za 5h"
 *   - <1h: "Za 35 min"
 *   - = teraz: "Teraz"
 *   - przeszłość: "Spóźnione 2d" (red tone)
 */
function formatDueBadge(
  dueAtIso: string | null,
  isCompleted: boolean,
): { text: string; tone: 'past' | 'soon' | 'today' | 'far' | 'done' } | null {
  if (!dueAtIso) return null
  if (isCompleted) return { text: 'Zamknięte', tone: 'done' }

  const due = new Date(dueAtIso).getTime()
  const now = Date.now()
  const diff = due - now

  if (diff < -60_000) {
    const past = -diff
    if (past < HOUR_MS) {
      return { text: `Spóźnione ${Math.round(past / 60_000)} min`, tone: 'past' }
    }
    if (past < DAY_MS) {
      return { text: `Spóźnione ${Math.round(past / HOUR_MS)}h`, tone: 'past' }
    }
    return { text: `Spóźnione ${Math.round(past / DAY_MS)}d`, tone: 'past' }
  }

  if (Math.abs(diff) <= 60_000) return { text: 'Teraz', tone: 'soon' }

  if (diff < HOUR_MS) {
    return { text: `Za ${Math.round(diff / 60_000)} min`, tone: 'soon' }
  }
  if (diff < DAY_MS) {
    return { text: `Za ${Math.round(diff / HOUR_MS)}h`, tone: 'today' }
  }
  if (diff < 7 * DAY_MS) {
    return { text: `Za ${Math.round(diff / DAY_MS)} dni`, tone: 'today' }
  }
  const d = new Date(dueAtIso)
  return {
    text: d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }),
    tone: 'far',
  }
}

function dueToneClasses(tone: 'past' | 'soon' | 'today' | 'far' | 'done'): string {
  switch (tone) {
    case 'past':
      return 'bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
    case 'soon':
      return 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200'
    case 'today':
      return 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300'
    case 'done':
      return 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
    case 'far':
    default:
      return 'bg-zinc-200/70 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300'
  }
}

function TaskItem({
  aggregate,
  currentUserId,
  userNames,
  onToggleMine,
  onToggleGlobal,
  onDelete,
}: {
  aggregate: CohortTaskAggregate
  currentUserId: string
  userNames?: Map<string, string>
  onToggleMine: (taskId: number) => void
  onToggleGlobal: (taskId: number) => void
  onDelete: (taskId: number) => void
}) {
  const { task, completionsCount, completionUserIds, myCompletedAt } = aggregate
  const [expanded, setExpanded] = useState(false)
  const isCompletedGlobal = task.completed_at != null
  const isMine = myCompletedAt != null
  const isCreator = task.created_by === currentUserId
  const dueBadge = formatDueBadge(task.due_at, isCompletedGlobal)

  return (
    <li
      className={[
        'group rounded-lg border px-2.5 py-2 transition-colors',
        isCompletedGlobal
          ? 'border-emerald-300/40 bg-emerald-50/40 dark:border-emerald-400/20 dark:bg-emerald-400/[0.04]'
          : 'border-zinc-200 bg-white/70 hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onToggleMine(task.id)}
          aria-pressed={isMine}
          aria-label={isMine ? 'Odznacz „ja zrobiłem"' : 'Oznacz „ja zrobiłem"'}
          title={isMine ? 'Odznacz „ja zrobiłem"' : 'Oznacz „ja zrobiłem"'}
          className={[
            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            isMine
              ? 'border-[#1e293b] bg-[#1e293b] text-white dark:border-brand-gold-bright dark:bg-brand-gold-bright dark:text-bg-card'
              : 'border-zinc-300 bg-transparent hover:border-zinc-500 dark:border-white/25 dark:hover:border-white/45',
          ].join(' ')}
        >
          {isMine && <CheckSquare size={11} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="block w-full text-left"
          >
            <p
              className={[
                'truncate text-sm font-semibold leading-snug',
                isCompletedGlobal ? 'text-zinc-400 line-through dark:text-zinc-500' : 'text-fg-primary',
              ].join(' ')}
            >
              {task.title}
            </p>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <TaskPriorityPill priority={(task.priority as 'low' | 'normal' | 'high') ?? 'normal'} />
            {dueBadge && (
              <span
                className={[
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold',
                  dueToneClasses(dueBadge.tone),
                ].join(' ')}
              >
                {dueBadge.tone === 'past' ? <AlarmClock size={9} /> : <CalendarClock size={9} />}
                {dueBadge.text}
              </span>
            )}
            <span className="text-zinc-400 dark:text-zinc-500">
              · {completionsCount} {completionsCount === 1 ? 'zrobił' : 'zrobiło'}
            </span>
          </div>
        </div>
        {isCreator && !isCompletedGlobal && (
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label="Usuń zadanie"
            title="Usuń zadanie"
            className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-zinc-200/70 pt-2 dark:border-white/10">
          {task.description && (
            <p className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>
              Dodał {' '}
              <strong className="text-zinc-700 dark:text-zinc-200">
                {userNames?.get(task.created_by) ?? 'ktoś'}
              </strong>
              {' '}{relativeTime(task.created_at)}
            </span>
            {isCompletedGlobal && task.completed_by && (
              <span>
                · Zamknął {' '}
                <strong className="text-zinc-700 dark:text-zinc-200">
                  {userNames?.get(task.completed_by) ?? 'ktoś'}
                </strong>
              </span>
            )}
          </div>
          {completionUserIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>Zrobili:</span>
              {completionUserIds.slice(0, 5).map((uid) => (
                <span
                  key={uid}
                  className="inline-flex max-w-[8rem] truncate rounded-full bg-black/[0.04] px-1.5 py-0.5 dark:bg-white/[0.04]"
                  title={userNames?.get(uid) ?? uid}
                >
                  {userNames?.get(uid) ?? '…'}
                </span>
              ))}
              {completionUserIds.length > 5 && (
                <span>+{completionUserIds.length - 5}</span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => onToggleGlobal(task.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-black/[0.05] px-2 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-black/[0.08] dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
          >
            {isCompletedGlobal ? (
              <>
                <Unlock size={11} /> Otwórz ponownie
              </>
            ) : (
              <>
                <Lock size={11} /> Zamknij dla wszystkich
              </>
            )}
          </button>
        </div>
      )}
    </li>
  )
}

type TaskFilter = 'all' | 'today' | 'overdue' | 'open' | 'closed'

const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'Wszystkie',
  today: 'Dziś',
  overdue: 'Spóźnione',
  open: 'Otwarte',
  closed: 'Zamknięte',
}

/**
 * Zwraca true jeśli `iso` przypada między startOfToday a endOfToday w
 * lokalnej strefie. `due_at == null` zawsze false (zadania bezterminowe
 * nie wpadają w "dziś").
 */
function isDueToday(iso: string | null): boolean {
  if (!iso) return false
  const due = new Date(iso)
  const now = new Date()
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

function ChannelTasksEditor({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
}: Omit<SharedProps, 'onClose'>) {
  const { tasks, createTask, deleteTask, toggleMyCompletion, toggleGlobalDone } = useChannelTasks({
    cohortId,
    channelId,
    currentUserId,
  })
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [filter, setFilter] = useState<TaskFilter>('all')

  // Liczniki per filter — używane do badge w tab bar. Liczymy raz, w jednym
  // przebiegu (O(N)) zamiast 5x filter (5*O(N) = bez różnicy ale schludniej).
  const counts = useMemo(() => {
    const now = Date.now()
    let all = 0
    let today = 0
    let overdue = 0
    let open = 0
    let closed = 0
    for (const agg of tasks) {
      all += 1
      const isClosed = agg.task.completed_at != null
      if (isClosed) {
        closed += 1
        continue
      }
      open += 1
      if (agg.task.due_at) {
        const due = new Date(agg.task.due_at).getTime()
        if (due < now - 60_000) overdue += 1
        if (isDueToday(agg.task.due_at)) today += 1
      }
    }
    return { all, today, overdue, open, closed }
  }, [tasks])

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    const now = Date.now()
    return tasks.filter((agg) => {
      const isClosed = agg.task.completed_at != null
      if (filter === 'closed') return isClosed
      if (filter === 'open') return !isClosed
      if (filter === 'today') return !isClosed && isDueToday(agg.task.due_at)
      if (filter === 'overdue') {
        if (isClosed) return false
        if (!agg.task.due_at) return false
        return new Date(agg.task.due_at).getTime() < now - 60_000
      }
      return true
    })
  }, [tasks, filter])

  const FILTERS: TaskFilter[] = ['all', 'today', 'overdue', 'open', 'closed']

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10">
        <CheckSquare
          size={14}
          className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg-primary">Zadania: {channelName}</p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {counts.all === 0
              ? 'Brak zadań. Dodaj pierwsze!'
              : `${counts.open} otwarte · ${counts.closed} zamknięte`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreatorOpen(true)}
          aria-label="Dodaj zadanie"
          title="Dodaj zadanie"
          className="inline-flex items-center gap-1 rounded-md bg-[#1e293b] px-2 py-1 text-xs font-bold text-white transition-colors hover:bg-[#1e293b]/90 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
        >
          <Plus size={12} />
          Dodaj
        </button>
      </div>

      {/* Filter tabs — pokazujemy tylko gdy są jakieś taski (UX: pusty rail
          z 5 zerami to noise). Spóźnione mają czerwoną kropkę gdy > 0. */}
      {counts.all > 0 && (
        <div className="border-b border-zinc-200/70 px-2 py-1.5 dark:border-white/10">
          <div className="custom-scrollbar flex items-center gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const active = filter === f
              const c = counts[f]
              const isOverdueWithCount = f === 'overdue' && c > 0
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={[
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-bg-card'
                      : isOverdueWithCount
                        ? 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:bg-rose-400/15 dark:text-rose-300 dark:hover:bg-rose-400/25'
                        : 'bg-black/[0.04] text-zinc-600 hover:bg-black/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]',
                  ].join(' ')}
                >
                  <span>{FILTER_LABELS[f]}</span>
                  {c > 0 && (
                    <span
                      className={[
                        'inline-flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] leading-none',
                        active
                          ? 'bg-white/25 text-white dark:bg-bg-card/35 dark:text-bg-card'
                          : isOverdueWithCount
                            ? 'bg-rose-600/20 text-rose-700 dark:bg-rose-400/25 dark:text-rose-200'
                            : 'bg-black/10 text-zinc-700 dark:bg-white/15 dark:text-zinc-200',
                      ].join(' ')}
                    >
                      {c}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {counts.all === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <CheckCircle2 size={32} className="mb-2 text-zinc-300 dark:text-white/15" />
            <p className="text-sm font-semibold text-fg-primary">Brak zadań</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Dodaj pierwszy deadline — projekt, kolokwium, oddanie zadania…
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            <CheckCircle2 size={28} className="mb-2 text-zinc-300 dark:text-white/15" />
            <p className="text-sm font-semibold text-fg-primary">Nic w tej kategorii</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Zmień filter albo dodaj nowe zadanie.
            </p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e293b] underline-offset-2 hover:underline dark:text-brand-gold-bright"
            >
              Pokaż wszystkie
            </button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filteredTasks.map((agg) => (
              <TaskItem
                key={agg.task.id}
                aggregate={agg}
                currentUserId={currentUserId}
                userNames={userNames}
                onToggleMine={toggleMyCompletion}
                onToggleGlobal={toggleGlobalDone}
                onDelete={deleteTask}
              />
            ))}
          </ul>
        )}
      </div>

      {creatorOpen && (
        <TaskCreator
          onClose={() => setCreatorOpen(false)}
          onConfirm={(payload) => void createTask(payload)}
        />
      )}
    </div>
  )
}

export function ChannelTasksPanel({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
  onClose,
}: SharedProps) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-white/10 dark:bg-bg-card xl:flex">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <CheckSquare size={11} />
          Zadania
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij zadania"
          className="rounded-md p-1 text-zinc-400 hover:bg-black/[0.05] hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
        >
          <X size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ChannelTasksEditor
          cohortId={cohortId}
          channelId={channelId}
          channelName={channelName}
          currentUserId={currentUserId}
          userNames={userNames}
        />
      </div>
    </aside>
  )
}

export function ChannelTasksSheet({
  cohortId,
  channelId,
  channelName,
  currentUserId,
  userNames,
  onClose,
}: SharedProps) {
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBodyOverflow
      html.style.overflow = prevHtmlOverflow
    }
  }, [])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Zadania sali"
      className="fixed inset-0 z-210 xl:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? { duration: 0.12 } : { duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 z-220 flex max-h-[85vh] flex-col rounded-t-3xl border border-zinc-200 bg-white/95 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={
          shouldReduceMotion
            ? { duration: 0.16 }
            : { type: 'spring', stiffness: 460, damping: 40, mass: 0.7 }
        }
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-white/15" />
        <div className="min-h-0 flex-1">
          <ChannelTasksEditor
            cohortId={cohortId}
            channelId={channelId}
            channelName={channelName}
            currentUserId={currentUserId}
            userNames={userNames}
          />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
