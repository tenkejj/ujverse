/**
 * Empty state `/chat` — propozycja A:
 * pixelowy Versuś z activity states → headline → composer → chipy.
 */

import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, ClipboardList, Megaphone, Send } from 'lucide-react'
import VersuMark, { type VersuActivity } from './VersuMark'

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
  const [focused, setFocused] = useState(false)

  const activity: VersuActivity = isTyping
    ? 'thinking'
    : focused || draft.trim().length > 0
      ? 'listening'
      : 'greeting'

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
          <VersuMark size={112} activity={activity} />
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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
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
              <span
                className="pointer-events-none inline-flex items-center rounded-xl border border-zinc-200/90 bg-zinc-50/95 px-2 py-1.5 dark:border-white/10 dark:bg-zinc-900/90"
                title="Versuś"
              >
                <VersuMark size={28} activity={activity} />
              </span>

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
              <Icon
                size={14}
                strokeWidth={1.9}
                aria-hidden
                className="text-brand-gold-bright/90"
              />
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
