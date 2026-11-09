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
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Megaphone,
  MessageCircle,
  Plus,
  Send,
  Square,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Profile } from '../../types'
import { CHAT_ASSISTANT_NAME } from '../../lib/chatModel'
import { useLocation, useNavigate } from 'react-router-dom'
import type { VersusEntryState } from '../../lib/versusEntry'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import { useVersuActivity } from '../../hooks/useVersuActivity'
import VersuMark from './VersuMark'
import MessageList from './MessageList'
import ChatVoiceButton from './ChatVoiceButton'

import {
  CHAT_QUICK_PROMPTS,
  PUBLIC_CHAT_QUICK_PROMPTS,
} from '../../lib/chatQuickPrompts'

const PROMPT_PRESENTATION: Record<string, { label: string; icon: LucideIcon }> =
  {
    'Najnowsze ogłoszenia': { label: 'Komunikaty', icon: Megaphone },
    'Jakie są nadchodzące rejestracje USOS?': {
      label: 'Rejestracje',
      icon: ClipboardList,
    },
    'Wydarzenia oficjalne': { label: 'Wydarzenia', icon: CalendarDays },
    'Co potrafisz?': { label: 'Co umiesz?', icon: MessageCircle },
    'Co nowego na feedzie?': { label: 'Społeczność', icon: Users },
    'Co mam dziś w planie?': { label: 'Plan na dziś', icon: CalendarDays },
    'Co mam jutro?': { label: 'Plan na jutro', icon: CalendarDays },
    'Pokaż zniżki studenckie': { label: 'Zniżki', icon: GraduationCap },
    'Co w Auli?': { label: 'Moja Aula', icon: Users },
  }

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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const hasMessages = useMemo(
    () => messages.some((m) => m.role !== 'system'),
    [messages],
  )

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

  const onKeyDownTextarea = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend(draft)
      }
    },
    [draft, handleSend],
  )

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`
  }, [draft])

  const canClear = hasMessages || isTyping

  return (
    <div
      className="versus-conversation flex w-full flex-col h-[calc(100dvh-3.5rem-5.5rem-4.25rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-9rem)]"
      data-has-messages={hasMessages}
    >
      <header className="versus-conversation-header shrink-0">
        <div className="versus-conversation-inner versus-conversation-header-content">
          <div className="versus-conversation-identity">
            {hasMessages ? (
              <VersuMark
                size={88}
                activity={activity}
                replayKey={messages.at(-1)?.id}
                className="versus-conversation-header-mark"
              />
            ) : null}
            <div className="min-w-0">
              <h1>
                Versuś <span>AI</span>
              </h1>
              <p className="versus-chat-caption">
                {activity === 'answering'
                  ? 'Odpowiadam…'
                  : activity === 'thinking'
                    ? (actionLabel ?? 'Przygotowuję odpowiedź…')
                    : activity === 'error'
                      ? 'Nie udało się odpowiedzieć'
                      : activity === 'success'
                        ? 'Możesz dopytać'
                        : isAuthenticated
                          ? 'Twój asystent na UJ'
                          : 'Zapytaj bez logowania'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={!canClear}
            title="Nowa rozmowa"
            aria-label="Rozpocznij nową rozmowę z asystentem"
            className="versus-conversation-new"
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            <span className="hidden min-[380px]:inline">Nowa rozmowa</span>
          </button>
        </div>
      </header>

      {hasMessages ? (
        <div
          ref={scrollRef}
          className="versus-conversation-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="versus-conversation-inner versus-conversation-messages">
            <MessageList
              messages={messages}
              isTyping={isTyping}
              actionLabel={actionLabel}
              variant="roomy"
              myProfile={myProfile}
              displayName={displayName}
              scrollable={false}
              scrollContainerRef={scrollRef}
              onEditLastUser={handleEditLastUser}
              onRetryLastAssistant={handleRetryLastAssistant}
              onChipClick={handleSend}
            />
          </div>
        </div>
      ) : (
        <div className="versus-conversation-empty min-h-0 overflow-y-auto">
          <div className="versus-conversation-inner versus-conversation-welcome">
            <VersuMark
              size={160}
              activity={activity}
              className="versus-conversation-hero-mark"
            />
            <div className="versus-conversation-welcome-copy">
              <h2>Co dziś sprawdzamy?</h2>
              <p>
                {isAuthenticated
                  ? 'Komunikaty z uczelni, terminy czy Twój plan — pytaj po swojemu.'
                  : 'Komunikaty, rejestracje i wydarzenia na UJ. Zapytaj po swojemu.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="versus-conversation-composer shrink-0">
        <div className="versus-conversation-inner">
          {error ? (
            <p
              className="mb-3 text-sm text-rose-700 dark:text-rose-300"
              role="alert"
            >
              Nie udało się uzyskać odpowiedzi. Sprawdź połączenie i spróbuj
              ponownie.
            </p>
          ) : null}
          <form onSubmit={onSubmitForm} className="versus-conversation-form">
            <ChatVoiceButton
              onTranscript={(text) => {
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
              placeholder="Zapytaj Versusia…"
              rows={1}
              disabled={isTyping}
              className="versus-conversation-input"
            />
            {isTyping ? (
              <button
                type="button"
                onClick={cancel}
                aria-label="Zatrzymaj odpowiedź"
                title="Zatrzymaj odpowiedź"
                className="versus-conversation-send versus-conversation-stop"
              >
                <Square
                  size={16}
                  strokeWidth={2.5}
                  fill="currentColor"
                  aria-hidden
                />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Wyślij wiadomość"
                disabled={!draft.trim()}
                className="versus-conversation-send"
              >
                <Send size={20} strokeWidth={2} aria-hidden />
              </button>
            )}
          </form>
          <p className="versus-conversation-note">
            {CHAT_ASSISTANT_NAME} może się mylić. Ważne informacje potwierdź w
            źródle.
          </p>
        </div>
      </div>

      {!hasMessages ? (
        <div
          className="versus-conversation-inner versus-conversation-suggestions"
          role="group"
          aria-label="Sugerowane pytania"
        >
          {(isAuthenticated
            ? CHAT_QUICK_PROMPTS
            : PUBLIC_CHAT_QUICK_PROMPTS
          ).map((prompt) => {
            const presentation = PROMPT_PRESENTATION[prompt]
            const Icon = presentation?.icon ?? MessageCircle
            return (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSend(prompt)}
                disabled={isTyping}
                aria-label={prompt}
                title={prompt}
              >
                <Icon size={19} strokeWidth={1.75} aria-hidden />
                <span>{presentation?.label ?? prompt}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
