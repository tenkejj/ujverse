/**
 * `ChatAssistantFab` — mobilny FAB + bottom-sheet (90 vh) z asystentem AI
 * (`DEFAULT_GROQ_MODEL` z `api/_lib/llmService.ts`, obecnie `qwen/qwen3-32b`).
 *
 * Powierzchnia komplementarna do desktopowej wyspy `ChatAssistant`:
 * - Wyspa: widoczna w lewym `<aside>` `FeedView` na `lg+`.
 * - FAB:   renderowany globalnie w `App.tsx`, klasa `lg:hidden` ukrywa go
 *   na desktopie (mobile + tablet) — zero zdublowanej powierzchni jednocześnie.
 *
 * Stan czatu (`messages`, `isTyping`, `isOpen`) i streaming (`useChatSend`)
 * są współdzielone — historia z mobilki widoczna na desktopie i odwrotnie.
 *
 * Glassmorphism zgodny ze sheetem compose w `App.tsx`:
 * spring `damping: 28, stiffness: 300`, backdrop blur, border-t.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, Square, X } from 'lucide-react'
import type { Profile } from '../../types'
import { CHAT_MODEL_LABEL } from '../../lib/chatModel'
import { theme } from '../../styles/theme'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import AnimatedBot from './AnimatedBot'
import ChatVoiceButton from './ChatVoiceButton'
import MessageList from './MessageList'

type Props = {
  /** Gdy `true` — komponent nic nie renderuje (kolizja z innym sheetem). */
  hidden?: boolean
  /** Profil zalogowanego użytkownika — awatar w wierszach jego wiadomości. */
  myProfile?: Profile | null
  /** Fallback inicjału awatara, gdy `myProfile` brak. */
  displayName?: string
}

/**
 * Glassmorphism złożone z tokenów `theme.colors.*` (jedno źródło prawdy z
 * `BaseCard variant="default"`); `border-t` zamiast pełnego `border` bo
 * sheet jest dosunięty do dolnej krawędzi viewportu.
 */
const SHEET_GLASS_CLS = [
  theme.colors.surface.base,
  theme.colors.surface.glass,
  theme.colors.border.base,
  'border-t',
].join(' ')

/**
 * Quick prompts — IDENTYCZNE z `ChatAssistant.QUICK_PROMPTS` i
 * `ChatHubView.QUICK_PROMPTS`. Świadoma duplikacja (patrz docstring
 * w `ChatHubView`): każda powierzchnia trzyma własną kopię, ale
 * stringi MUSZĄ być 1:1, żeby `buildResponseCacheKey` (normalizuje
 * tekst) dawał cross-surface cache hit.
 *
 * Mapowanie tool → patrz docstring w `ChatAssistant.QUICK_PROMPTS`.
 *
 * Mobile-specific UX: pillsy renderujemy TYLKO przy pustej historii
 * (`messages.length === 0`) — po pierwszej wiadomości znikają, żeby
 * nie zżerać miejsca w 90dvh sheetcie podczas aktywnej rozmowy
 * (wzorzec ChatGPT / Claude mobile).
 */
const QUICK_PROMPTS = [
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Co w przyszłym tygodniu?',
  'Pokaż zniżki studenckie',
] as const

export default function ChatAssistantFab({
  hidden = false,
  myProfile,
  displayName,
}: Props) {
  const messages = useChatStore((s) => s.messages)
  const isTyping = useChatStore((s) => s.isTyping)
  const actionLabel = useChatStore((s) => s.actionLabel)
  const isOpen = useChatStore((s) => s.isOpen)
  const setOpen = useChatStore((s) => s.setOpen)
  const { sendMessage, cancel } = useChatSend()

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isOpen) return
    el.scrollTop = el.scrollHeight
  }, [messages, isTyping, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, setOpen])

  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [isOpen])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const handleEditLastUser = useCallback(
    (text: string) => {
      if (isTyping) return
      useChatStore.getState().removeLastTurn()
      setDraft(text)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    },
    [isTyping],
  )

  const handleRetryLastAssistant = useCallback(() => {
    if (isTyping) return
    const { lastUserText } = useChatStore.getState().removeLastTurn()
    if (lastUserText && lastUserText.length > 0) {
      void sendMessage(lastUserText)
    }
  }, [isTyping, sendMessage])

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isTyping) return
      setDraft('')
      await sendMessage(trimmed)
    },
    [isTyping, sendMessage],
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

  if (hidden) return null

  const fab = (
    <motion.button
      key="chat-fab"
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Otwórz asystenta AI"
      className="fixed right-4 z-200 flex h-14 w-14 items-center justify-center rounded-full bg-[#1e293b] text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-shadow hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)] lg:hidden dark:bg-brand-gold-bright dark:text-zinc-950"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
    >
      <AnimatedBot size={22} strokeWidth={2} intensity="idle" />
    </motion.button>
  )

  const sheet = (
    <motion.div
      key="chat-overlay"
      className="fixed inset-x-0 top-0 z-320 flex h-[100dvh] flex-col justify-end lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="min-h-0 flex-1 bg-black/55 backdrop-blur-[2px]"
        aria-hidden
        onClick={handleClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Asystent UJverse"
        className={`flex max-h-[90dvh] min-h-0 flex-col overflow-hidden rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_-16px_48px_rgba(0,0,0,0.55)] ${SHEET_GLASS_CLS}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto mt-2 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />

        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e293b] text-white dark:bg-brand-gold-bright dark:text-zinc-950">
              <AnimatedBot size={16} strokeWidth={2.2} intensity={isTyping ? 'active' : 'idle'} />
            </span>
            <div className="flex flex-col leading-tight">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Asystent UJverse
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{CHAT_MODEL_LABEL}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Zamknij asystenta"
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <MessageList
          ref={scrollRef}
          messages={messages}
          isTyping={isTyping}
          actionLabel={actionLabel}
          variant="roomy"
          className="px-4 py-3"
          myProfile={myProfile}
          onEditLastUser={handleEditLastUser}
          onRetryLastAssistant={handleRetryLastAssistant}
          displayName={displayName}
        />

        {messages.length === 0 ? (
          <div
            className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Szybkie pytania"
          >
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSend(prompt)}
                disabled={isTyping}
                className="shrink-0 rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#1e293b] backdrop-blur-md transition-colors hover:border-[#1e293b]/30 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950/50 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/70"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={onSubmitForm}
          className={`flex items-end gap-2 border-t px-3 py-3 ${theme.colors.border.base}`}
        >
          <ChatVoiceButton
            size="compact"
            disabled={isTyping}
            onTranscript={(text) => {
              setDraft((prev) => (prev ? prev + ' ' + text : text))
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
          />
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDownTextarea}
            placeholder="Napisz wiadomość..."
            rows={1}
            disabled={isTyping}
            className={`max-h-32 min-h-10 flex-1 resize-none rounded-2xl border bg-white/80 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/15 disabled:opacity-60 dark:bg-zinc-900/70 dark:text-zinc-100 dark:focus:border-brand-gold-bright dark:focus:ring-brand-gold-bright/20 ${theme.colors.border.base}`}
          />
          {isTyping ? (
            <button
              type="button"
              onClick={cancel}
              aria-label="Zatrzymaj odpowiedź"
              title="Zatrzymaj odpowiedź"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              <Square size={14} strokeWidth={2.5} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Wyślij wiadomość"
              disabled={draft.trim().length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-950"
            >
              <Send size={17} strokeWidth={2} />
            </button>
          )}
        </form>
      </motion.section>
    </motion.div>
  )

  return createPortal(
    <>
      <AnimatePresence>{!isOpen && fab}</AnimatePresence>
      <AnimatePresence>{isOpen && sheet}</AnimatePresence>
    </>,
    document.body,
  )
}
