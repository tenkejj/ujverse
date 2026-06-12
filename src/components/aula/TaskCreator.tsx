/**
 * UJverse — TaskCreator: modal do tworzenia zadania (deadline).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Fields:
 *   - title (wymagane, 1–200 znaków)
 *   - description (opcjonalne, ≤2000)
 *   - due_at (opcjonalne — datetime-local, konwersja do ISO przy submit)
 *   - priority (pigułki radio: low/normal/high, default normal)
 *
 * Walidacja klient-side mirrowana z CHECK constraint w DB (length/priority).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Calendar, CheckSquare, X } from 'lucide-react'
import type { TaskPriority } from '../../types/database'
import { TASK_PRIORITIES, TASK_PRIORITY_META } from './TaskPriorityPill'

export type TaskCreatorPayload = {
  title: string
  description: string | null
  dueAt: string | null
  priority: TaskPriority
}

type Props = {
  onClose: () => void
  onConfirm: (payload: TaskCreatorPayload) => void
}

const TITLE_MAX = 200
const DESC_MAX = 2000

const fieldCls =
  // text-base na mobile (≥16px) → iOS Safari NIE auto-zoomuje na focusie.
  // text-sm dopiero od sm: (768+) gdzie i tak nie ma touch keyboard.
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-base text-zinc-900 outline-none sm:text-sm ' +
  'placeholder:text-zinc-400 focus:border-[#1e293b] ' +
  'dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500 ' +
  'dark:focus:border-brand-gold-bright'

const labelCls =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-white/55'

const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e293b] px-5 py-2.5 text-sm font-bold ' +
  'text-white transition-colors hover:bg-[#1e293b]/90 ' +
  'dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85 ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const ghostBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ' +
  'text-zinc-600 transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5'

/** datetime-local string (lokalna strefa) → ISO. Empty = null. */
function dueLocalToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function TaskCreator({ onClose, onConfirm }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueLocal, setDueLocal] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmedTitle = title.trim()
  const validation = useMemo<
    { kind: 'idle' } | { kind: 'error'; msg: string } | { kind: 'ok' }
  >(() => {
    if (trimmedTitle.length === 0) return { kind: 'idle' }
    if (trimmedTitle.length > TITLE_MAX) {
      return { kind: 'error', msg: `Tytuł max ${TITLE_MAX} znaków.` }
    }
    if (description.length > DESC_MAX) {
      return { kind: 'error', msg: `Opis max ${DESC_MAX} znaków.` }
    }
    return { kind: 'ok' }
  }, [trimmedTitle, description.length])

  const canSubmit = validation.kind === 'ok'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onConfirm({
      title: trimmedTitle,
      description: description.trim() === '' ? null : description.trim(),
      dueAt: dueLocalToIso(dueLocal),
      priority,
    })
    onClose()
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Nowe zadanie"
      className="fixed inset-0 z-220 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-bg-card/97"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-base font-bold text-fg-primary">
            <CheckSquare size={16} className="text-[#1e293b] dark:text-brand-gold-bright" />
            Nowe zadanie
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="rounded-lg p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="task-title">
              Tytuł
            </label>
            <input
              ref={firstRef}
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              maxLength={TITLE_MAX}
              placeholder="np. „Projekt zaliczeniowy z baz danych"
              className={fieldCls}
            />
            <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
              {trimmedTitle.length}/{TITLE_MAX}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="task-desc">
              Opis (opcjonalnie)
            </label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              maxLength={DESC_MAX}
              rows={3}
              placeholder="Szczegóły, wymagania, linki…"
              className={fieldCls + ' resize-none'}
            />
            <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
              {description.length}/{DESC_MAX}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="task-due">
              <Calendar size={11} className="-mt-0.5 mr-1 inline" />
              Termin (opcjonalnie)
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className={fieldCls}
            />
          </div>

          <div>
            <span className={labelCls}>Priorytet</span>
            <div
              role="radiogroup"
              aria-label="Priorytet zadania"
              className="flex flex-wrap gap-1.5"
            >
              {TASK_PRIORITIES.map((p) => {
                const meta = TASK_PRIORITY_META[p]
                const selected = priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPriority(p)}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                      selected
                        ? `${meta.tint} ${meta.text} ring-2 ring-current/40`
                        : 'bg-black/[0.04] text-zinc-600 hover:bg-black/[0.06] dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.08]',
                    ].join(' ')}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {validation.kind === 'error' && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{validation.msg}</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtnCls}>
            Anuluj
          </button>
          <button type="submit" className={primaryBtnCls} disabled={!canSubmit}>
            Dodaj zadanie
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  )
}
