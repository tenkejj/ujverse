/**
 * Versus na stronie głównej — karta wejścia do `/chat` (pixelowy Versuś + pytanie).
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Megaphone,
  Send,
} from 'lucide-react'
import VersuMark from './VersuMark'
import { versusEntryState } from '../../lib/versusEntry'
import BaseCard from '../ui/BaseCard'

const SUGGESTIONS = [
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

export default function VersusEntry() {
  const [question, setQuestion] = useState('')
  const [isFocused, setFocused] = useState(false)
  const [isGreeting, setGreeting] = useState(false)
  const navigate = useNavigate()

  const ask = (prompt: string) =>
    navigate('/chat', { state: versusEntryState(prompt.trim()) })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (question.trim()) ask(question)
  }

  const activity = isFocused
    ? 'listening'
    : isGreeting
      ? 'greeting'
      : 'idle'

  return (
    <BaseCard
      as="section"
      className="versus-home-entry grid w-full grid-cols-1 gap-5 p-5 md:grid-cols-[148px_minmax(0,1fr)] md:gap-x-7 md:gap-y-4 md:p-7"
      aria-labelledby="versus-entry-heading"
    >
      <Link
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-brand-gold-bright/25 bg-black/25 px-3 py-4 text-fg-primary transition-colors hover:border-brand-gold-bright/45 md:row-span-2"
        to="/chat"
        aria-label="Otwórz rozmowę z Versusiem"
        onPointerEnter={() => setGreeting(true)}
        onPointerLeave={() => setGreeting(false)}
        onFocus={() => setGreeting(true)}
        onBlur={() => setGreeting(false)}
      >
        <VersuMark size={112} activity={activity} />
        <strong className="text-[15px] font-semibold tracking-tight">
          Versuś <span className="text-[10px] font-medium text-fg-secondary">AI</span>
        </strong>
        <span className="inline-flex items-center gap-1 text-[11px] text-brand-gold-bright">
          Otwórz czat <ArrowUpRight size={14} aria-hidden />
        </span>
      </Link>

      <header className="min-w-0 text-left">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id="versus-entry-heading"
            className="text-2xl font-semibold tracking-tight text-fg-primary md:text-[1.55rem]"
          >
            Co sprawdzić na UJ?
          </h2>
          <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-fg-secondary">
            Bez konta
          </span>
        </div>
        <p className="mt-2 max-w-[36rem] text-sm leading-relaxed text-fg-secondary">
          Komunikaty, rejestracje i wydarzenia — konkretnie, bez ściany tekstu.
        </p>
      </header>

      <form onSubmit={submit} className="min-w-0 text-left">
        <label
          htmlFor="versus-question"
          className="mb-2 block text-[13px] font-medium text-fg-primary"
        >
          Twoje pytanie
        </label>
        <div className="rounded-2xl border border-white/10 bg-black/30 focus-within:border-brand-gold-bright/45">
          <textarea
            id="versus-question"
            name="question"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Komunikat, rejestracja, termin…"
            value={question}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setQuestion(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`
            }}
            maxLength={4000}
            rows={2}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                if (question.trim()) ask(question)
              }
            }}
            className="min-h-[4.5rem] w-full resize-none bg-transparent px-3.5 py-3 text-base text-fg-primary outline-none placeholder:text-fg-secondary/70"
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={!question.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-gold-bright px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Wyślij
            <Send size={15} aria-hidden />
          </button>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Przykładowe pytania"
          >
            {SUGGESTIONS.map(({ label, prompt, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => ask(prompt)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-brand-gold-bright/35 hover:text-brand-gold-bright"
              >
                <Icon size={14} strokeWidth={1.85} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </BaseCard>
  )
}
