/**
 * `ChatHubView` — pełnoekranowa podstrona `/chat` asystenta AI.
 *
 * Filozofia layoutu — wzorzec Claude / Gemini / ChatGPT:
 *  - Powierzchnia rozciąga się od krawędzi do krawędzi viewportu (bez asides,
 *    bez `max-w-7xl`). `App.tsx` ustawia dla widoku `chat` puste `<main>` —
 *    pełną kontrolę layoutu ma ten komponent.
 *  - Wysokość = `100dvh - sticky header (- mobilny BottomNav)`, więc input
 *    dock siedzi na dolnej krawędzi widocznego obszaru; obszar wiadomości
 *    scrolluje się niezależnie.
 *  - Czytelność: bąble i input centrowane w `max-w-3xl` mimo szerokiego
 *    canvasa — analog do Claude (wide canvas, centered content).
 *
 * Empty state: personalizowane powitanie z `displayName` (Claude/Gemini-style).
 *
 * Stan czatu (`useChatStore`) i streaming (`useChatSend`) są współdzielone
 * z desktopową wyspą (`ChatAssistant`) i mobilnym FAB-em (`ChatAssistantFab`).
 *
 * Quick prompts trzymane lokalnie — świadome zduplikowanie z `ChatAssistant`
 * (komentarz w `ChatAssistant` linia 17-18 explicite zakazuje przeniesienia
 * do `src/lib/`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Plus, Send } from 'lucide-react'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import AnimatedBot from './AnimatedBot'
import MessageList from './MessageList'

const QUICK_PROMPTS = [
  'Pokaż wydarzenia na weekend',
  'Streszcz nowości z WZiKS',
  'Co popularne na feedzie?',
  'Wyjaśnij zasady platformy',
] as const

type Props = {
  displayName: string
}

function firstNameFrom(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

export default function ChatHubView({ displayName }: Props) {
  const messages = useChatStore((s) => s.messages)
  const isTyping = useChatStore((s) => s.isTyping)
  const { sendMessage, cancel } = useChatSend()

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const hasMessages = useMemo(
    () => messages.some((m) => m.role !== 'system'),
    [messages],
  )
  const firstName = useMemo(() => firstNameFrom(displayName), [displayName])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isTyping) return
      setDraft('')
      await sendMessage(trimmed)
    },
    [isTyping, sendMessage],
  )

  const handleNewConversation = useCallback(
    (e?: MouseEvent<HTMLButtonElement>) => {
      // Defensive: zapobiega ewentualnemu „przelaniu" kliknięcia na rodziców
      // (np. handler scrolla / focus capture na liście wiadomości), żeby
      // przycisk niezawodnie clearował historię nawet podczas streamingu.
      e?.preventDefault()
      e?.stopPropagation()
      cancel()
      // Bierzemy `clearHistory` z `getState()` zamiast z subskrypcji selektora —
      // gwarantuje to świeżą referencję funkcji nawet, gdyby callback został
      // zamknięty na starym kontekście (np. po HMR / lazy chunk re-imporcie).
      useChatStore.getState().clearHistory()
      setDraft('')
      // Mały delay żeby focus przeskoczył po re-renderze pustego stanu.
      window.setTimeout(() => inputRef.current?.focus(), 50)
    },
    [cancel],
  )

  const onSubmitForm = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      void handleSend(draft)
    },
    [draft, handleSend],
  )

  const onKeyDownTextarea = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend(draft)
      }
    },
    [draft, handleSend],
  )

  return (
    <div
      className={[
        'flex w-full flex-col',
        // Mobile: full viewport minus sticky header (h-14) minus mobile BottomNav (~4.25rem).
        // Desktop: full viewport minus sticky header (h-16). BottomNav is md:hidden.
        'h-[calc(100dvh-3.5rem-4.25rem-env(safe-area-inset-bottom,0px))]',
        'md:h-[calc(100dvh-4rem)]',
      ].join(' ')}
    >
      {hasMessages ? (
        <>
          <div className="shrink-0 border-b border-zinc-200/60 dark:border-white/5">
            <div className="mx-auto flex w-full max-w-3xl justify-end px-4 py-2 md:px-6">
              <button
                type="button"
                onClick={handleNewConversation}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-zinc-700 backdrop-blur-md transition-colors hover:border-[#1e293b]/30 hover:bg-white hover:text-[#1e293b] active:scale-[0.97] dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:border-brand-gold-bright/40 dark:hover:bg-zinc-900/70 dark:hover:text-brand-gold-bright"
                aria-label="Rozpocznij nową rozmowę z asystentem"
              >
                <Plus size={14} strokeWidth={2.4} aria-hidden />
                Nowa rozmowa
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-zinc-800"
          >
            <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-2 md:px-6 md:pt-8">
              <MessageList
                messages={messages}
                isTyping={isTyping}
                variant="roomy"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-[10vh] pb-4 text-center md:px-6 md:pt-[14vh]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 text-[#1e293b] dark:text-brand-gold-bright"
            >
              <AnimatedBot size={64} strokeWidth={1.5} intensity="wave" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="bg-linear-to-br from-[#1e293b] to-[#1e293b]/60 bg-clip-text pb-1 text-3xl leading-tight font-semibold tracking-tight text-transparent md:text-4xl dark:from-brand-gold-bright dark:to-brand-gold-bright/55"
            >
              {firstName ? `Witaj, ${firstName}.` : 'Witaj.'}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 text-base text-zinc-500 md:text-lg dark:text-zinc-400"
            >
              W czym mogę dziś pomóc?
            </motion.p>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-zinc-200/70 bg-zinc-50/85 backdrop-blur-md dark:border-white/10 dark:bg-bg-app/85">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-3 md:px-6 md:pt-4 md:pb-4">
          {!hasMessages && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mb-3 flex flex-wrap items-center justify-center gap-1.5 md:gap-2"
              role="list"
              aria-label="Sugerowane pytania"
            >
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  role="listitem"
                  onClick={() => void handleSend(prompt)}
                  disabled={isTyping}
                  className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur-md transition-colors hover:border-[#1e293b]/30 hover:bg-zinc-50 hover:text-[#1e293b] disabled:cursor-not-allowed disabled:opacity-40 md:text-sm dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-300 dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/70 dark:hover:text-brand-gold-bright"
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}

          <form onSubmit={onSubmitForm} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDownTextarea}
              placeholder="Napisz wiadomość..."
              rows={1}
              disabled={isTyping}
              className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white/90 p-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/15 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:border-brand-gold-bright dark:focus:ring-brand-gold-bright/20"
            />
            <button
              type="submit"
              aria-label="Wyślij wiadomość"
              disabled={isTyping || draft.trim().length === 0}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-950"
            >
              <Send size={18} strokeWidth={2} />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            Asystent UJverse może się mylić — sprawdzaj ważne informacje.
          </p>
        </div>
      </div>
    </div>
  )
}
