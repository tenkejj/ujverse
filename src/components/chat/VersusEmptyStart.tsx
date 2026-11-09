/**
 * Empty state `/chat` — propozycja A:
 * jedna kolumna (mark → headline → composer z portretem → chipy → drobny dostęp).
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, ChevronDown, ClipboardList, Megaphone, Send } from 'lucide-react'
import {
  readVersusPortrait,
  writeVersusPortrait,
  VERSUS_PORTRAITS,
  type VersusPortraitId,
} from '../../lib/versusPortrait'
import VersuMark from './VersuMark'
import VersusPortraitFace from './VersusPortraitFace'

const EMPTY_CHIPS = [
  {
    label: 'Nowe komunikaty',
    prompt: 'Najnowsze ogłoszenia',
    Icon: Megaphone,
  },
  {
    label: 'Rejestracje',
    prompt: 'Jakie są nadchodzące rejestracje USOS?',
    Icon: ClipboardList,
  },
  {
    label: 'Ten tydzień',
    prompt: 'Co w przyszłym tygodniu?',
    Icon: CalendarDays,
  },
] as const

type Props = {
  draft: string
  onDraftChange: (value: string) => void
  onSend: (content: string) => void
  isTyping: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
}

export default function VersusEmptyStart({
  draft,
  onDraftChange,
  onSend,
  isTyping,
  inputRef,
}: Props) {
  const [portrait, setPortrait] = useState<VersusPortraitId>('owl')
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()

  useEffect(() => {
    setPortrait(readVersusPortrait())
  }, [])

  useEffect(() => {
    if (!pickerOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const choosePortrait = (id: VersusPortraitId) => {
    setPortrait(id)
    writeVersusPortrait(id)
    setPickerOpen(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || isTyping) return
    onSend(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (draft.trim() && !isTyping) onSend(draft)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center md:px-6 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <VersuMark size={56} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="text-balance text-3xl font-semibold tracking-tight text-fg-primary md:text-4xl"
        >
          Co sprawdzić na UJ?
        </motion.h1>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={submit}
          className="relative mt-7 w-full"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-950/70">
            <label htmlFor="versus-empty-question" className="sr-only">
              Twoje pytanie
            </label>
            <textarea
              id="versus-empty-question"
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                onDraftChange(e.target.value)
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`
              }}
              onKeyDown={onKeyDown}
              placeholder="Komunikat, rejestracja, termin…"
              rows={3}
              disabled={isTyping}
              className="min-h-[5.5rem] w-full resize-none bg-transparent px-4 pb-14 pt-3.5 text-left text-base leading-relaxed text-fg-primary outline-none placeholder:text-fg-secondary/70 disabled:opacity-60"
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2.5 pb-2.5">
              <div ref={pickerRef} className="pointer-events-auto relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  aria-controls={listboxId}
                  aria-label="Wybierz wygląd Versusia w rozmowie"
                  onClick={() => setPickerOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-zinc-50/95 px-2 py-1.5 text-fg-secondary transition-colors hover:border-logo-navy/30 hover:text-logo-navy dark:border-white/10 dark:bg-zinc-900/90 dark:hover:border-brand-gold-bright/35 dark:hover:text-brand-gold-bright"
                >
                  <VersusPortraitFace portrait={portrait} size={26} />
                  <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
                </button>

                {pickerOpen ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-label="Wygląd Versusia"
                    className="absolute bottom-full left-0 z-20 mb-2 min-w-[11.5rem] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-left shadow-lg dark:border-white/10 dark:bg-zinc-950"
                  >
                    {VERSUS_PORTRAITS.map((option) => {
                      const selected = option.id === portrait
                      return (
                        <li key={option.id} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onClick={() => choosePortrait(option.id)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                              selected
                                ? 'bg-logo-navy/8 text-logo-navy dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright'
                                : 'text-fg-primary hover:bg-zinc-50 dark:hover:bg-zinc-900'
                            }`}
                          >
                            <VersusPortraitFace portrait={option.id} size={28} />
                            <span className="flex min-w-0 flex-col leading-tight">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-[11px] text-fg-secondary">
                                {option.hint}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isTyping || draft.trim().length === 0}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-logo-navy px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-950"
              >
                Wyślij
                <Send size={15} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 flex w-full flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Przykładowe pytania"
        >
          {EMPTY_CHIPS.map(({ label, prompt, Icon }) => (
            <button
              key={label}
              type="button"
              disabled={isTyping}
              onClick={() => onSend(prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-logo-navy/30 hover:text-logo-navy disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950/50 dark:hover:border-brand-gold-bright/30 dark:hover:text-brand-gold-bright"
            >
              <Icon size={14} strokeWidth={1.9} aria-hidden className="text-brand-gold-bright/90" />
              {label}
            </button>
          ))}
        </motion.div>

        <p className="mt-5 text-[12px] text-fg-secondary/80">
          Możesz zacząć bez konta
        </p>
      </div>
    </div>
  )
}
