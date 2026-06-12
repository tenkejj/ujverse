/**
 * UJverse — PollCreator: modal do tworzenia ankiety doczepionej do wiadomości.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * MVP single-select. Walidacja:
 *   - question: 1–240 znaków po trim()
 *   - opcje: 2–10, każda 1–80 znaków, unique (case-insensitive ignore whitespace)
 *
 * Confirm zwraca `{ question, options }` i zamyka modal. AulaComposer
 * trzyma to w lokalnym `pendingPoll` i pokazuje preview chip; właściwy
 * INSERT pollu (po INSERT wiadomości) robi `useCohortMessages.sendMessage`
 * → `CohortService.createPollRecord`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { BarChart3, Plus, Trash2, X } from 'lucide-react'

export type PollCreatorPayload = {
  question: string
  options: string[]
}

type Props = {
  onClose: () => void
  onConfirm: (payload: PollCreatorPayload) => void
}

const QUESTION_MAX = 240
const OPTION_MAX = 80
const MIN_OPTIONS = 2
const MAX_OPTIONS = 10

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

function normalizeForUnique(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export default function PollCreator({ onClose, onConfirm }: Props) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const firstRef = useRef<HTMLInputElement | null>(null)
  const lastOptionRef = useRef<HTMLInputElement | null>(null)
  const shouldFocusLastRef = useRef(false)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    if (shouldFocusLastRef.current) {
      shouldFocusLastRef.current = false
      lastOptionRef.current?.focus()
    }
  }, [options.length])

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

  const trimmedQuestion = question.trim()
  const cleanedOptions = useMemo(() => options.map((o) => o.trim()), [options])

  const validation = useMemo<
    { kind: 'idle' } | { kind: 'error'; msg: string } | { kind: 'ok' }
  >(() => {
    if (trimmedQuestion.length === 0) return { kind: 'idle' }
    if (trimmedQuestion.length > QUESTION_MAX) {
      return { kind: 'error', msg: `Pytanie max ${QUESTION_MAX} znaków.` }
    }
    const nonEmpty = cleanedOptions.filter((o) => o.length > 0)
    if (nonEmpty.length < MIN_OPTIONS) {
      return { kind: 'error', msg: `Potrzeba co najmniej ${MIN_OPTIONS} opcji.` }
    }
    if (nonEmpty.some((o) => o.length > OPTION_MAX)) {
      return { kind: 'error', msg: `Opcja max ${OPTION_MAX} znaków.` }
    }
    const seen = new Set<string>()
    for (const o of nonEmpty) {
      const k = normalizeForUnique(o)
      if (seen.has(k)) {
        return { kind: 'error', msg: 'Opcje muszą być unikalne.' }
      }
      seen.add(k)
    }
    return { kind: 'ok' }
  }, [trimmedQuestion, cleanedOptions])

  const canSubmit = validation.kind === 'ok'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const nonEmpty = cleanedOptions.filter((o) => o.length > 0)
    onConfirm({ question: trimmedQuestion, options: nonEmpty })
    onClose()
  }

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return
    shouldFocusLastRef.current = true
    setOptions((prev) => [...prev, ''])
  }

  const removeOption = (idx: number) => {
    if (options.length <= MIN_OPTIONS) return
    setOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  const setOptionAt = (idx: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value.slice(0, OPTION_MAX) : o)))
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Nowa ankieta"
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
            <BarChart3 size={16} className="text-[#1e293b] dark:text-brand-gold-bright" />
            Nowa ankieta
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
            <label className={labelCls} htmlFor="poll-question">
              Pytanie
            </label>
            <textarea
              ref={firstRef as unknown as React.Ref<HTMLTextAreaElement>}
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX))}
              maxLength={QUESTION_MAX}
              rows={2}
              placeholder="O co pytasz rocznik? np. „Kto wpada na piwko po wykładzie?”"
              className={fieldCls + ' resize-none'}
            />
            <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
              {trimmedQuestion.length}/{QUESTION_MAX}
            </div>
          </div>

          <div>
            <span className={labelCls}>
              Opcje ({cleanedOptions.filter((o) => o.length > 0).length}/{MAX_OPTIONS})
            </span>
            <div className="space-y-2">
              {options.map((opt, i) => {
                const isLast = i === options.length - 1
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                      {i + 1}
                    </span>
                    <input
                      ref={isLast ? lastOptionRef : undefined}
                      type="text"
                      value={opt}
                      onChange={(e) => setOptionAt(i, e.target.value)}
                      maxLength={OPTION_MAX}
                      placeholder={`Opcja ${i + 1}`}
                      className={fieldCls + ' !p-2.5 text-sm'}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={options.length <= MIN_OPTIONS}
                      aria-label={`Usuń opcję ${i + 1}`}
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
              >
                <Plus size={13} />
                Dodaj opcję
              </button>
            )}
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
            Dodaj do wiadomości
          </button>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          Każdy w roczniku zobaczy ankietę i będzie mógł oddać 1 głos. Głosy są
          jawne — wszyscy widzą kto na co głosował.
        </p>
      </motion.form>
    </motion.div>,
    document.body,
  )
}
