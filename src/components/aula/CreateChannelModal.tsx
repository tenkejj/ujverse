/**
 * UJverse — CreateChannelModal: tworzenie / edycja Sali w Auli.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * UX:
 *   1) Name (1–60 znaków) — auto-derive slug w locie (user może nadpisać).
 *   2) Typ (wyk/ćw/lab/sem/proj/inne) — pigułki radio, default `inne`.
 *   3) Slug (regex `^[a-z0-9][a-z0-9_-]{0,30}$`, reserved `general`).
 *   4) Description (≤280, opcjonalne).
 *
 * Walidacja po stronie klienta. Uniqueness CHECK pochodzi z constraintu DB
 * — przy konflikcie `useCohortChannels.createChannel` pokaże toast i modal
 * zostaje otwarty (caller decyduje).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { deriveSlugFromName, isValidChannelSlug } from '../../hooks/useCohortChannels'
import type { ChannelKind } from '../../types/database'
import {
  CHANNEL_KINDS,
  CHANNEL_KIND_META,
} from './ChannelKindPill'

type Props = {
  onClose: () => void
  onSubmit: (input: {
    slug: string
    name: string
    description: string | null
    kind: ChannelKind
  }) => Promise<unknown>
  /** Istniejące slugi w cohortzie (do live duplicate check, oszczędza round-trip). */
  existingSlugs?: ReadonlySet<string>
  /**
   * Tryb edycji: prefill name/description/kind, slug locked (zmiana slug
   * zerwałaby URL deep-linki). `submitLabel` customowy.
   */
  mode?: 'create' | 'edit'
  initialSlug?: string
  initialName?: string
  initialDescription?: string | null
  initialKind?: ChannelKind
  title?: string
  submitLabel?: string
}

const NAME_MAX = 60
const DESC_MAX = 280
const SLUG_MAX = 31

const fieldCls =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-zinc-900 outline-none ' +
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

export default function CreateChannelModal({
  onClose,
  onSubmit,
  existingSlugs,
  mode = 'create',
  initialSlug,
  initialName,
  initialDescription,
  initialKind,
  title,
  submitLabel,
}: Props) {
  const isEdit = mode === 'edit'
  const [name, setName] = useState(initialName ?? '')
  const [slug, setSlug] = useState(initialSlug ?? '')
  // W trybie edit slug locked → uznaj że "dirty" żeby nie nadpisywać.
  const [slugDirty, setSlugDirty] = useState(isEdit)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [kind, setKind] = useState<ChannelKind>(initialKind ?? 'inne')
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  // Auto-derive slug z name dopóki user go nie tknął ręcznie (lub jest edit).
  useEffect(() => {
    if (slugDirty) return
    setSlug(deriveSlugFromName(name))
  }, [name, slugDirty])

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Lock scrolla body
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  const trimmedName = name.trim()
  const validation = useMemo(() => {
    if (trimmedName.length === 0) return { kind: 'idle' as const }
    if (trimmedName.length > NAME_MAX) {
      return { kind: 'error' as const, msg: `Nazwa max ${NAME_MAX} znaków.` }
    }
    if (slug === 'general') {
      return { kind: 'error' as const, msg: '"general" jest zarezerwowane.' }
    }
    if (!slug) {
      return { kind: 'error' as const, msg: 'Slug nie może być pusty.' }
    }
    if (!isValidChannelSlug(slug)) {
      return {
        kind: 'error' as const,
        msg: 'Slug: małe litery, cyfry, `-` lub `_`. Bez spacji.',
      }
    }
    if (!isEdit && existingSlugs?.has(slug)) {
      return { kind: 'error' as const, msg: 'Sala o tym slug już istnieje.' }
    }
    if (description.length > DESC_MAX) {
      return { kind: 'error' as const, msg: `Opis max ${DESC_MAX} znaków.` }
    }
    return { kind: 'ok' as const }
  }, [trimmedName, slug, description.length, existingSlugs, isEdit])

  const canSubmit = validation.kind === 'ok' && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        slug,
        name: trimmedName,
        description: description.trim() === '' ? null : description.trim(),
        kind,
      })
      // Caller decyduje co dalej — domyślnie zamykamy modal.
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edytuj salę' : 'Stwórz nową salę'}
      className="fixed inset-0 z-220 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <div className="absolute inset-0 bg-black/55" onClick={() => !submitting && onClose()} />
      <motion.form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-bg-card/97"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-fg-primary">
            {title ?? (isEdit ? 'Edytuj salę' : 'Nowa sala')}
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Zamknij"
            className="rounded-lg p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="channel-name">
              Nazwa sali
            </label>
            <input
              ref={nameRef}
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
              placeholder="np. Projekt baza danych"
              className={fieldCls}
              disabled={submitting}
            />
            <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
              {trimmedName.length}/{NAME_MAX}
            </div>
          </div>

          <div>
            <span className={labelCls}>Typ zajęć</span>
            <div
              role="radiogroup"
              aria-label="Typ sali"
              className="flex flex-wrap gap-1.5"
            >
              {CHANNEL_KINDS.map((k) => {
                const meta = CHANNEL_KIND_META[k]
                const selected = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={meta.long}
                    onClick={() => setKind(k)}
                    disabled={submitting}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                      selected
                        ? `${meta.tint} ${meta.text} ring-2 ring-current/40`
                        : 'bg-black/[0.04] text-zinc-600 hover:bg-black/[0.06] dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.08]',
                    ].join(' ')}
                  >
                    <span className="uppercase tracking-wide">{meta.label}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {meta.long.toLowerCase()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="channel-slug">
              Slug (URL)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-400 dark:text-zinc-500">/</span>
              <input
                id="channel-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  if (isEdit) return
                  setSlug(e.target.value.toLowerCase().slice(0, SLUG_MAX))
                  setSlugDirty(true)
                }}
                maxLength={SLUG_MAX}
                placeholder="projekt-baza-danych"
                className={fieldCls}
                disabled={submitting || isEdit}
                title={isEdit ? 'Slug nie można zmienić (zerwałoby URL deep-linki).' : undefined}
              />
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">
              Małe litery, cyfry, `-` lub `_`. Max {SLUG_MAX} znaków. Reserved: `general`.
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="channel-desc">
              Opis (opcjonalnie)
            </label>
            <textarea
              id="channel-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              maxLength={DESC_MAX}
              rows={2}
              placeholder="O czym jest ta sala?"
              className={fieldCls + ' resize-none'}
              disabled={submitting}
            />
            <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
              {description.length}/{DESC_MAX}
            </div>
          </div>

          {validation.kind === 'error' && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{validation.msg}</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className={ghostBtnCls}
            disabled={submitting}
          >
            Anuluj
          </button>
          <button type="submit" className={primaryBtnCls} disabled={!canSubmit}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitLabel ?? (isEdit ? 'Zapisz zmiany' : 'Stwórz salę')}
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  )
}
