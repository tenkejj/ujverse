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
import { Plus, Send, Square } from 'lucide-react'
import type { Profile } from '../../types'
import { CHAT_ASSISTANT_NAME } from '../../lib/chatModel'
import { useLocation, useNavigate } from 'react-router-dom'
import type { VersusEntryState } from '../../lib/versusEntry'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import { useVersuActivity } from '../../hooks/useVersuActivity'
import {
  filterSlashCommands,
  isSlashMode,
  type SlashCommand,
} from '../../lib/chatSlashCommands'
import VersuMark from './VersuMark'
import MessageList from './MessageList'
import SlashCommandMenu from './SlashCommandMenu'
import ChatVoiceButton from './ChatVoiceButton'

import {
  CHAT_QUICK_PROMPTS,
  PUBLIC_CHAT_QUICK_PROMPTS,
} from '../../lib/chatQuickPrompts'

type Props = {
  displayName: string
  isAuthenticated?: boolean
  /** Profil zalogowanego użytkownika — awatar w wierszach jego wiadomości. */
  myProfile?: Profile | null
}

export default function ChatHubView({
  displayName,
  myProfile,
  isAuthenticated = false,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const consumedEntry = useRef<string | null>(null)
  const error = useChatStore((s) => s.error)
  const messages = useChatStore((s) => s.messages)
  const isTyping = useChatStore((s) => s.isTyping)
  const actionLabel = useChatStore((s) => s.actionLabel)
  const { sendMessage, cancel } = useChatSend()

  const [draft, setDraft] = useState('')
  const [isFocused, setFocused] = useState(false)
  const activity = useVersuActivity(isFocused && draft.trim().length > 0)
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const slashMode = useMemo(() => isSlashMode(draft), [draft])
  const slashCommands = useMemo(
    () =>
      slashMode
        ? filterSlashCommands(draft).filter(
            (command) =>
              isAuthenticated ||
              [
                'oglosznia',
                'tydzien',
                'naukowe',
                'wziks',
                'juwenalia',
                'rejestracje',
                'pomoc',
              ].includes(command.slug),
          )
        : [],
    [slashMode, draft, isAuthenticated],
  )
  const slashOpen = slashMode

  // Reset active index gdy lista się skraca lub user kasuje slash.
  useEffect(() => {
    if (slashActiveIndex >= slashCommands.length) {
      setSlashActiveIndex(0)
    }
  }, [slashCommands.length, slashActiveIndex])

  const hasMessages = useMemo(
    () => messages.some((m) => m.role !== 'system'),
    [messages],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

  useEffect(() => {
    if (
      !window.matchMedia('(min-width: 768px)').matches ||
      (location.state as Partial<VersusEntryState> | null)?.versusPrompt
    )
      return
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [location.state])

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isTyping) return
      setDraft('')
      await sendMessage(trimmed)
    },
    [isTyping, sendMessage],
  )

  const entry = location.state as Partial<VersusEntryState> | null
  const entryId = entry?.versusRequestId
  const entryPrompt = entry?.versusPrompt
  useEffect(() => {
    if (
      typeof entryId !== 'string' ||
      typeof entryPrompt !== 'string' ||
      !entryPrompt.trim() ||
      isTyping ||
      consumedEntry.current === entryId
    )
      return
    // Wait until mount effects settle: StrictMode replays their setup/cleanup,
    // and useChatSend correctly cancels a stream during that cleanup.
    const timer = window.setTimeout(() => {
      consumedEntry.current = entryId
      void handleSend(entryPrompt.slice(0, 4000))
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    entryId,
    entryPrompt,
    isTyping,
    handleSend,
    navigate,
    location.pathname,
    location.search,
  ])

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

  const handleSelectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      // Słownie wysyłamy zapytanie odpowiadające komendzie. Cache (`responseCache`
      // po stronie serwera) trafia te same prompty co `QUICK_PROMPTS` w wyspie.
      setDraft('')
      setSlashActiveIndex(0)
      void handleSend(cmd.query)
    },
    [handleSend],
  )

  const onKeyDownTextarea = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash mode: ArrowUp/Down nawigują listę, Enter wybiera, Escape zamyka.
      if (slashOpen && slashCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSlashActiveIndex((i) => (i + 1) % slashCommands.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSlashActiveIndex(
            (i) => (i - 1 + slashCommands.length) % slashCommands.length,
          )
          return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const cmd = slashCommands[slashActiveIndex] ?? slashCommands[0]
          if (cmd) handleSelectSlashCommand(cmd)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft('')
          return
        }
        if (e.key === 'Tab') {
          // Tab uzupełnia slug aktywnej komendy w drafcie (jak shell).
          e.preventDefault()
          const cmd = slashCommands[slashActiveIndex] ?? slashCommands[0]
          if (cmd) setDraft(`/${cmd.slug} `)
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend(draft)
      }
    },
    [
      draft,
      handleSend,
      slashOpen,
      slashCommands,
      slashActiveIndex,
      handleSelectSlashCommand,
    ],
  )

  const canClear = hasMessages || isTyping

  return (
    <div
      className={[
        'flex w-full flex-col',
        // Mobile: full viewport minus sticky header (h-14) minus mobile BottomNav (~4.25rem).
        // Desktop: full viewport minus sticky header (h-16). BottomNav is md:hidden.
        'h-[calc(100dvh-3.5rem-5.5rem-4.25rem-env(safe-area-inset-bottom,0px))]',
        'md:h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-9rem)]',
      ].join(' ')}
    >
      {/*
        Header zawsze widoczny — orientuje użytkownika (kto mówi, jaki model)
        i daje niezawodne miejsce na akcję „nowa rozmowa". Stary pattern
        ukrywał akcję razem z wiadomościami, więc po kliknięciu znikała razem
        z efektem, co czytało się jak „nic się nie stało". Teraz przycisk
        zostaje na ekranie, tylko przechodzi w stan `disabled` — wyraźny
        feedback wizualny.
      */}
      <header className="shrink-0 border-b border-zinc-200/60 bg-zinc-50/90 backdrop-blur-md dark:border-white/10 dark:bg-bg-app/90">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <VersuMark
              size={72}
              activity={activity}
              replayKey={messages.at(-1)?.id}
              className="shrink-0"
            />
            <div className="min-w-0 flex flex-col leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-tight text-fg-primary">
                  Versuś
                </h1>
              </div>
              <p className="versus-chat-caption truncate text-[11px]">
                {activity === 'answering'
                  ? 'Odpowiadam…'
                  : activity === 'thinking'
                    ? (actionLabel ?? 'Myślę nad odpowiedzią…')
                    : activity === 'error'
                      ? 'Nie udało się odpowiedzieć'
                      : activity === 'success'
                        ? 'Gotowe — możesz dopytać'
                        : isAuthenticated
                          ? 'Twój asystent studencki AI'
                          : 'Asystent studencki AI · Bez logowania'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={!canClear}
            title="Nowa rozmowa"
            aria-label="Rozpocznij nową rozmowę z asystentem"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-logo-navy/25 bg-transparent px-3 py-2 text-xs font-semibold text-logo-navy transition-colors hover:border-logo-navy/45 hover:bg-logo-navy/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-brand-gold-bright/35 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/55 dark:hover:bg-brand-gold-bright/10 sm:px-3.5 sm:text-sm"
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden />
            <span className="hidden min-[380px]:inline">Nowa rozmowa</span>
          </button>
        </div>
      </header>

      {hasMessages ? (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-zinc-800"
        >
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-2 md:px-6 md:pt-8">
            <MessageList
              messages={messages}
              isTyping={isTyping}
              actionLabel={actionLabel}
              variant="roomy"
              myProfile={myProfile}
              displayName={displayName}
              scrollable={false}
              onEditLastUser={handleEditLastUser}
              onRetryLastAssistant={handleRetryLastAssistant}
              onChipClick={handleSend}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="versus-chat-welcome mx-auto flex w-full max-w-3xl flex-col items-start px-5 pb-8 md:px-8">
            <VersuMark size={96} activity={activity} className="mb-6" />
            <h2 className="text-2xl font-semibold tracking-tight text-fg-primary md:text-3xl">
              Co chcesz wiedzieć o UJ?
            </h2>
            <p className="versus-chat-caption mt-3 max-w-md text-sm leading-relaxed">
              {isAuthenticated
                ? 'Sprawdź informacje z uczelni lub zapytaj o swój plan.'
                : 'Zapytaj o komunikaty, terminy rejestracji i wydarzenia. Możesz zacząć bez zakładania konta.'}
            </p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="versus-chat-suggestions mt-6 flex w-full flex-wrap gap-x-6 gap-y-2"
              role="group"
              aria-label="Sugerowane pytania"
            >
              {(isAuthenticated
                ? CHAT_QUICK_PROMPTS
                : PUBLIC_CHAT_QUICK_PROMPTS
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSend(prompt)}
                  disabled={isTyping}
                  className="versus-quick-prompt rounded text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-zinc-200/70 bg-zinc-50/85 backdrop-blur-md dark:border-white/10 dark:bg-bg-app/85">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-3 md:px-6 md:pt-4 md:pb-4">
          {/*
            `relative` wrapper jest anchorem dla `SlashCommandMenu`, który
            renderuje się `absolute bottom-full` (czyli NAD inputem). Bez tego
            menu by uciekło do prawego krańca viewportu.
          */}
          {error ? (
            <p
              className="mb-3 text-sm text-rose-700 dark:text-rose-300"
              role="alert"
            >
              Nie udało się uzyskać odpowiedzi. Sprawdź połączenie i spróbuj
              ponownie.
            </p>
          ) : null}
          <form
            onSubmit={onSubmitForm}
            className="relative flex items-end gap-2"
          >
            {slashOpen && (
              <SlashCommandMenu
                commands={slashCommands}
                activeIndex={slashActiveIndex}
                onActiveIndexChange={setSlashActiveIndex}
                onSelect={handleSelectSlashCommand}
                onClose={() => setDraft('')}
              />
            )}
            <ChatVoiceButton
              onTranscript={(text) => {
                // UX: nie auto-sendujemy — wkładamy tekst w composer żeby user
                // mógł doszlifować przed wysłaniem. To istotne dla PL Whispera,
                // który potrafi pomylić nazwy własne (WZIKS, MISH, etc.).
                setDraft((prev) => (prev ? prev + ' ' + text : text))
                window.setTimeout(() => inputRef.current?.focus(), 0)
              }}
              disabled={isTyping}
              size="regular"
            />
            <textarea
              ref={inputRef}
              value={draft}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDownTextarea}
              aria-label="Wiadomość do Versusia"
              name="message"
              placeholder="Twoje pytanie…"
              rows={1}
              disabled={isTyping}
              className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white/90 p-3 text-sm text-fg-primary shadow-sm outline-none transition-colors focus:border-logo-navy focus:ring-2 focus:ring-logo-navy/15 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/80 dark:focus:border-brand-gold-bright dark:focus:ring-brand-gold-bright/20"
            />
            {isTyping ? (
              <button
                type="button"
                onClick={cancel}
                aria-label="Zatrzymaj odpowiedź"
                title="Zatrzymaj odpowiedź"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
              >
                <Square size={16} strokeWidth={2.5} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Wyślij wiadomość"
                disabled={draft.trim().length === 0}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-logo-navy text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-950"
              >
                <Send size={18} strokeWidth={2} />
              </button>
            )}
          </form>
          <p className="versus-chat-caption mt-2 text-center text-[11px]">
            {CHAT_ASSISTANT_NAME} może się mylić — sprawdzaj ważne informacje.
          </p>
        </div>
      </div>
    </div>
  )
}
