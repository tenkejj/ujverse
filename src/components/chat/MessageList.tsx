/**
 * `MessageList` — wspólna lista wiadomości czatu AI, reużywana przez
 * desktopową wyspę (`ChatAssistant`) i mobilny bottom-sheet (`ChatAssistantFab`).
 *
 * Wariant `size`:
 * - `compact` — gęsta lista do wyspy (text-xs, padding 2.5/1.5).
 * - `roomy`   — luźniejsza, do bottom-sheetu (text-sm, padding 3/2).
 *
 * Renderowanie odpowiedzi asystenta przez `react-markdown` + `remark-gfm`
 * z własnym mapowaniem komponentów (UJverse nie ma `@tailwindcss/typography`).
 *
 * Auto-scroll: `ResizeObserver` na wewnętrznym wrapperze treści automatycznie
 * dosuwa scroll do dołu, gdy zawartość rośnie (typewriter tickujący lokalnie
 * w `TypewriterMarkdown` nie zmienia propsów rodzica, więc bez obserwera
 * scroll zatrzymywałby się przy pierwszym chunku SSE i nie podążałby za
 * dopisywanymi znakami). `stickToBottomRef` respektuje sytuację, gdy user
 * sam przewinął w górę — wtedy auto-scroll się wycofuje, aż wróci do dołu.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  Pencil,
  RefreshCcw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { ChatMessage } from '../../types/ai'
import type { Profile } from '../../types'
import { toast } from '../../lib/appToast'
import { useChatFeedback } from '../../hooks/useChatFeedback'
import UserAvatar from '../UserAvatar'
import AnimatedBot from './AnimatedBot'
import type { VersuActivity } from './VersuMark'
import TypewriterMarkdown from './TypewriterMarkdown'

const STICK_TO_BOTTOM_TOLERANCE_PX = 48

export type MessageListVariant = 'compact' | 'roomy'

type Props = {
  messages: ChatMessage[]
  isTyping: boolean
  variant?: MessageListVariant
  emptyState?: ReactNode
  className?: string
  /** Profil bieżącego użytkownika — używany do awatara po prawej stronie. */
  myProfile?: Profile | null
  /** Fallback display name (np. z `session.user.email`), gdy `myProfile` brak. */
  displayName?: string
  /**
   * Konkretna etykieta akcji asystenta z meta-eventu SSE (np. „Sprawdzam
   * zniżki…"). Gdy ustawione, `TypingIndicator` pokaże ją zamiast losowych
   * thinking-phrases. `null` lub `undefined` = spokojny, stały status.
   */
  actionLabel?: string | null
  /**
   * Wstawia tekst ostatniej user message do composera (parent kontroluje
   * gdzie pole input żyje). Klik na ikonę „Edytuj" przy ostatniej wiadomości
   * usera. `undefined` = nie pokazuj akcji edit.
   */
  onEditLastUser?: (text: string) => void
  /**
   * Wysyła ostatnią user message ponownie (parent zna `sendMessage`
   * i historię). Klik „Spróbuj ponownie" przy ostatniej assistant
   * message. `undefined` = nie pokazuj retry.
   */
  onRetryLastAssistant?: () => void
  /**
   * Klik w chip follow-up („Tylko jedzenie", „Co jutro?") pod ostatnią
   * assistant message → parent wysyła tekst chipa jako nowe pytanie.
   * `undefined` = chipy się nie renderują (np. embedded preview).
   */
  onChipClick?: (text: string) => void
  /**
   * Czy lista ma sama trzymać scroll (`overflow-y-auto` + stick-to-bottom
   * observer). Domyślnie `true` — pasuje do wyspy (`ChatAssistant`) i FAB-a
   * (`ChatAssistantFab`), gdzie rodzic ma zafiksowaną wysokość i to lista
   * jest jedynym scrollerem.
   *
   * `false` → lista renderuje się jako zwykły blok (zero overflow, zero
   * observerów); scroll trzyma rodzic. Używane przez `ChatHubView`, gdzie
   * zewnętrzny `<div ref={scrollRef}>` jest właściwym scrollerem i podwójny
   * overflow + `overscroll-contain` w środku zabierał wheel events nad
   * długimi wiadomościami asystenta (bug: „nie skrolluje się jak najadę na
   * odpowiedź bota").
   */
  scrollable?: boolean
  /** Optional outer scroller; retains the same user-controlled bottom anchoring. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

type VariantTokens = {
  text: string
  userPad: string
  userMax: string
  /** Średnica okrągłego awatara/badge w klasach Tailwind (`h-N w-N`). */
  avatar: string
  /** Rozmiar portretu Versusia (px), bez dodatkowej ramki. */
  botIcon: number
  /** Rozmiar fontu inicjału w awatarze użytkownika. */
  avatarText: string
  /** Vertical gap między avatar a treścią (alignment offset). */
  rowGap: string
}

const VARIANT_TOKENS: Record<MessageListVariant, VariantTokens> = {
  compact: {
    text: 'text-sm',
    userPad: 'px-3.5 py-2',
    userMax: 'max-w-[78%]',
    avatar: 'h-7 w-7',
    botIcon: 44,
    avatarText: 'text-[11px]',
    rowGap: 'gap-2',
  },
  roomy: {
    text: 'text-base',
    userPad: 'px-4 py-2.5',
    userMax: 'max-w-[72%]',
    avatar: 'h-8 w-8',
    botIcon: 48,
    avatarText: 'text-xs',
    rowGap: 'gap-2.5',
  },
}

/** Assistant replies read as open text beside a prominent unframed portrait.
 * User messages retain the existing navy/gold theme and account avatar.
 */
const USER_BUBBLE_CLS =
  'rounded-2xl bg-logo-navy text-white ' +
  'dark:bg-brand-gold-bright dark:text-zinc-950'

const ASSISTANT_TEXT_CLS = 'text-fg-primary'

/** The portrait is the identity, without a second circular container. */
function BotBadge({
  size,
  activity = 'idle',
  replayKey,
}: {
  size: number
  activity?: VersuActivity
  replayKey?: string
}) {
  return (
    <span className="versus-message-avatar" aria-hidden>
      <AnimatedBot size={size} activity={activity} replayKey={replayKey} />
    </span>
  )
}

/**
 * Wspólne presety ruchu dla bąbelków — slide+fade. User idzie z prawej,
 * asystent z lewej (kierunek odwrotny do source-row), żeby wizualnie
 * podkreślić skąd pochodzi wiadomość.
 *
 * Distance 8px daje subtelny efekt — większy (16-24px) wyglądałby jak
 * carousel i odciągał uwagę. easeOut + 280ms = moment, w którym oko
 * zarejestruje pojawienie się bez „glitch-flash".
 */
const BUBBLE_MOTION_USER = {
  initial: { opacity: 0, x: 12, y: 4 },
  animate: { opacity: 1, x: 0, y: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as const },
}

const BUBBLE_MOTION_ASSISTANT = {
  initial: { opacity: 0, x: -8, y: 4 },
  animate: { opacity: 1, x: 0, y: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as const },
}

function MessageBubble({
  message,
  variant,
  isStreaming,
  isLastUser,
  isLastAssistant,
  myProfile,
  displayName,
  onEditUser,
  onRetryAssistant,
  onChipClick,
}: {
  message: ChatMessage
  variant: MessageListVariant
  isStreaming: boolean
  /** Czy to OSTATNIA user message — tylko wtedy pokazujemy „Edytuj". */
  isLastUser: boolean
  /** Czy to OSTATNIA assistant message — tylko wtedy „Spróbuj ponownie". */
  isLastAssistant: boolean
  myProfile?: Profile | null
  displayName?: string
  /** Callback do edycji ostatniej user message (parent wkłada tekst do composera). */
  onEditUser?: (text: string) => void
  /** Callback do retry — parent wysyła ostatnią user message ponownie. */
  onRetryAssistant?: () => void
  /** Callback do kliku w chip — parent wysyła tekst chipa jako nowe pytanie. */
  onChipClick?: (text: string) => void
}) {
  const isUser = message.role === 'user'
  const isEmptyAssistant =
    message.role === 'assistant' && message.content.length === 0
  if (isEmptyAssistant) return null

  const tokens = VARIANT_TOKENS[variant]

  if (isUser) {
    const userName = myProfile?.full_name ?? displayName ?? 'Ty'
    return (
      <motion.div
        className={`group/bubble flex items-center justify-end ${tokens.rowGap}`}
        {...BUBBLE_MOTION_USER}
      >
        {/* Akcje user message: tylko dla OSTATNIEJ — edit. Po lewej bańki, hover-only. */}
        {isLastUser && !isStreaming && onEditUser ? (
          <MessageActionButton
            icon={<Pencil size={12} />}
            label="Edytuj"
            onClick={() => onEditUser(message.content)}
          />
        ) : null}
        <div
          className={`${tokens.userMax} ${USER_BUBBLE_CLS} ${tokens.userPad} ${tokens.text}`}
        >
          <p className="whitespace-pre-wrap wrap-break-word">
            {message.content}
          </p>
        </div>
        <UserAvatar
          profile={myProfile}
          name={userName}
          className={`${tokens.avatar} self-center`}
          textSize={tokens.avatarText}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`versus-message-row group/bubble flex items-start ${tokens.rowGap}`}
      {...BUBBLE_MOTION_ASSISTANT}
    >
      <span className="versus-message-identity">
        <BotBadge
          size={tokens.botIcon}
          activity={isStreaming ? 'answering' : 'idle'}
          replayKey={message.id}
        />
      </span>
      <div
        className={`min-w-0 flex-1 ${ASSISTANT_TEXT_CLS} ${tokens.text} leading-relaxed`}
      >
        <div className="space-y-1">
          <TypewriterMarkdown
            content={message.content}
            isStreaming={isStreaming}
          />
          {/* Akcje na assistant message — pojawiają się na hover, ZAWSZE dla
              non-streaming bubble'a, dla streaming pokazujemy dopiero po końcu
              (mniej noise podczas pisania). */}
          {!isStreaming ? (
            <AssistantMessageActions
              message={message}
              canVote={Boolean(myProfile)}
              showRetry={isLastAssistant}
              onRetry={onRetryAssistant}
            />
          ) : null}
          {/* Chipy follow-up — tylko OSTATNIA assistant message po skończeniu
              streamu. Klik → parent wysyła tekst chipa jako nowe pytanie.
              Nie pokazujemy podczas pisania (rozprasza) ani dla starszych
              wiadomości (chipy są kontekstowe do AKTUALNEGO punktu rozmowy). */}
          {!isStreaming &&
          isLastAssistant &&
          message.chips &&
          message.chips.length > 0 &&
          onChipClick ? (
            <FollowUpChips chips={message.chips} onClick={onChipClick} />
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Pojedynczy mały button akcji obok bubble'a — używany przez user-message edit.
 * Ukryty domyślnie, pojawia się na hover'ze parent'a (`group/bubble`).
 */
function MessageActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-fg-secondary opacity-0 shadow-sm transition-all hover:bg-zinc-50 hover:text-logo-navy group-hover/bubble:flex group-hover/bubble:opacity-100 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 dark:hover:text-brand-gold-bright"
    >
      {icon}
    </button>
  )
}

/**
 * Pasek akcji pod assistant message: copy (zawsze), retry (tylko ostatnia).
 *
 * Hover-only — w state spoczynku UI jest minimalistyczne. Na touch device'ach
 * `group-hover` nie działa, więc także reagujemy na `group-focus-within`,
 * a tap na bubble (focus) ujawnia akcje.
 *
 * `aria-live=polite` na potwierdzeniu „Skopiowano" — screen reader informuje,
 * że akcja się udała, bez zabierania fokusu.
 */
function AssistantMessageActions({
  message,
  canVote,
  showRetry,
  onRetry,
}: {
  message: ChatMessage
  canVote: boolean
  showRetry: boolean
  onRetry?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const { vote } = useChatFeedback()
  const feedback = message.feedback ?? null

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      toast('Skopiowano')
      window.setTimeout(() => setCopied(false), 1600)
    } catch (err) {
      console.warn('[MessageList] copy failed:', err)
      toast.error('Nie udało się skopiować')
    }
  }, [message.content])

  // Klasy bazowe dla buttonow akcji - reuse zeby trzymac spojny look.
  // Po `feedback === up/down` dorzucamy aktywny styl (filled gold).
  const baseBtn =
    'inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 bg-white/80 px-1.5 text-xs text-fg-secondary transition-colors hover:bg-zinc-50 hover:text-logo-navy dark:border-white/10 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 dark:hover:text-brand-gold-bright'
  const activeBtn =
    'border-logo-navy/40 bg-logo-navy/5 text-logo-navy dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright'

  return (
    <div
      className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => void handleCopy()}
        title={copied ? 'Skopiowano' : 'Skopiuj'}
        aria-label={copied ? 'Skopiowano' : 'Skopiuj odpowiedź'}
        className={baseBtn}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span>{copied ? 'Skopiowano' : 'Kopiuj'}</span>
      </button>
      {/* Kciuk góra/dół — quality feedback. Aktywny przycisk dostaje
          subtle highlight (border + bg gold tint). Klik wysyła POST do
          `/api/chat-feedback` przez `useChatFeedback` hook; drugi klik
          tego samego cofa głos (DELETE). Toast tylko przy bledzie. */}
      {canVote ? (
        <>
          <button
            type="button"
            onClick={() => void vote(message, 'up')}
            title={feedback === 'up' ? 'Cofnij ocenę' : 'Dobra odpowiedź'}
            aria-label={
              feedback === 'up' ? 'Cofnij pozytywną ocenę' : 'Oceń pozytywnie'
            }
            aria-pressed={feedback === 'up'}
            className={`${baseBtn} ${feedback === 'up' ? activeBtn : ''}`}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => void vote(message, 'down')}
            title={feedback === 'down' ? 'Cofnij ocenę' : 'Słaba odpowiedź'}
            aria-label={
              feedback === 'down' ? 'Cofnij negatywną ocenę' : 'Oceń negatywnie'
            }
            aria-pressed={feedback === 'down'}
            className={`${baseBtn} ${feedback === 'down' ? activeBtn : ''}`}
          >
            <ThumbsDown size={12} />
          </button>
        </>
      ) : null}
      {showRetry && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          title="Spróbuj ponownie"
          aria-label="Wygeneruj odpowiedź ponownie"
          className={baseBtn}
        >
          <RefreshCcw size={12} />
          <span>Ponów</span>
        </button>
      ) : null}
    </div>
  )
}

/**
 * Follow-Up Chips — klikalne sugestie wyświetlane pod ostatnią assistant
 * message. Tekst chipa to faktyczne zapytanie wysyłane jako nowa user
 * message po kliknięciu (server widzi je jak normalny input).
 *
 * Wizualnie: pigułki w paskownicy poniżej action-row, w stylu UJverse
 * (zinc/gold). Zawijają się (`flex-wrap`) — przy 3 chipach na wąskim
 * mobile mogą iść w 2 rzędy, ale lepiej to niż horizontal scroll.
 *
 * Animacja: lekki fade-in po pojawieniu się (chipy lecą po skończeniu
 * streamu, więc user zobaczy je „dorzucone" do pełnej odpowiedzi).
 */
function FollowUpChips({
  chips,
  onClick,
}: {
  chips: readonly string[]
  onClick: (text: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="mt-2.5 flex flex-wrap gap-1.5"
      role="group"
      aria-label="Sugerowane pytania"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onClick(chip)}
          className="min-h-11 rounded-full border border-zinc-200 bg-white/80 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-logo-navy/40 hover:bg-zinc-50 hover:text-logo-navy dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-brand-gold-bright/40 dark:hover:bg-zinc-800 dark:hover:text-brand-gold-bright"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}

/** A truthful status until the first text delta arrives. */
function TypingIndicator({
  variant,
  actionLabel,
  replayKey,
}: {
  variant: MessageListVariant
  actionLabel: string | null
  replayKey?: string
}) {
  const tokens = VARIANT_TOKENS[variant]
  return (
    <div className={`flex items-center ${tokens.rowGap}`} role="status">
      <BotBadge
        size={tokens.botIcon}
        activity="thinking"
        replayKey={replayKey}
      />
      <span className="text-sm text-fg-secondary">
        {actionLabel || 'Przygotowuję odpowiedź…'}
      </span>
    </div>
  )
}

/**
 * Empty state — hero centrowany w pełnej dostępnej wysokości listy.
 * Większy badge ikony (halo z brand-tint) i wyraźniejsza typografia
 * sprawiają, że treść „siedzi" w środku karty zamiast wisieć na 1/3.
 *
 * `min-h-[14rem]` w compact daje pewność, że nawet w wąskich wysokościach
 * (np. wyspa z dużą ilością quick-promptów) ikona+tekst dostają wystarczającą
 * przestrzeń do centrowania.
 */
function DefaultEmptyState({ variant }: { variant: MessageListVariant }) {
  const isCompact = variant === 'compact'
  const title = isCompact ? 'text-base' : 'text-xl'
  const subtitle = isCompact ? 'text-xs' : 'text-sm'
  const iconSize = isCompact ? 112 : 144
  const minH = isCompact ? 'min-h-56' : 'min-h-80'
  return (
    <div
      className={`flex ${minH} h-full flex-col items-center justify-center gap-4 px-4 py-6 text-center`}
    >
      <span aria-hidden className="versus-message-empty-mark">
        <AnimatedBot size={iconSize} strokeWidth={1.6} intensity="wave" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={`${title} font-semibold text-fg-primary`}>
          Cześć! W czym mogę pomóc?
        </p>
        <p
          className={`${subtitle} mx-auto max-w-xs leading-snug text-fg-secondary`}
        >
          Zapytaj o komunikaty, terminy lub wydarzenia.
        </p>
      </div>
    </div>
  )
}

const MessageList = forwardRef<HTMLDivElement, Props>(function MessageList(
  {
    messages,
    isTyping,
    variant = 'compact',
    emptyState,
    className,
    myProfile,
    displayName,
    scrollable = true,
    scrollContainerRef,
    actionLabel = null,
    onEditLastUser,
    onRetryLastAssistant,
    onChipClick,
  },
  forwardedRef,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  // Merge forwarded ref z lokalnym — rodzic (np. `ChatAssistant`) wciąż
  // może użyć refa do imperatywnego scrolla na otwarciu sheetu, a my
  // mamy własny uchwyt do obserwatorów i logiki stick-to-bottom.
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef],
  )

  useEffect(() => {
    if (!scrollable && !scrollContainerRef) return
    const el = scrollContainerRef?.current ?? containerRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop
      stickToBottomRef.current = distance <= STICK_TO_BOTTOM_TOLERANCE_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollable, scrollContainerRef])

  useEffect(() => {
    if (!scrollable && !scrollContainerRef) return
    const container = scrollContainerRef?.current ?? containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return
      container.scrollTop = container.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollable, scrollContainerRef])

  const visible = messages.filter((m) => m.role !== 'system')
  const containerCls = scrollable
    ? `min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 ${className ?? ''}`
    : `flex w-full flex-col ${className ?? ''}`
  return (
    <div ref={setContainerRef} className={containerCls}>
      <div
        ref={contentRef}
        className={
          scrollable
            ? 'versus-message-flow flex min-h-full flex-col gap-5'
            : 'versus-message-flow flex flex-col gap-5'
        }
      >
        {visible.length === 0 ? (
          // `flex-1` zapewnia, że `DefaultEmptyState` (h-full) dostaje
          // definitywną wysokość wewnątrz flex-column wrappera.
          <div className={scrollable ? 'flex-1' : ''}>
            {emptyState ?? <DefaultEmptyState variant={variant} />}
          </div>
        ) : (
          (() => {
            // Index ostatniej user message — używany do pokazania „Edytuj"
            // tylko przy NIEJ. Liczymy raz, używamy w mapie poniżej.
            let lastUserIdx = -1
            for (let i = visible.length - 1; i >= 0; i--) {
              if (visible[i].role === 'user') {
                lastUserIdx = i
                break
              }
            }
            return visible.map((m, idx) => {
              const isLastAssistant =
                m.role === 'assistant' && idx === visible.length - 1
              const isLastUser = m.role === 'user' && idx === lastUserIdx
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  variant={variant}
                  isStreaming={isLastAssistant && isTyping}
                  isLastUser={isLastUser}
                  isLastAssistant={isLastAssistant}
                  myProfile={myProfile}
                  displayName={displayName}
                  onEditUser={onEditLastUser}
                  onRetryAssistant={onRetryLastAssistant}
                  onChipClick={onChipClick}
                />
              )
            })
          })()
        )}
        {isTyping &&
          !(
            visible.at(-1)?.role === 'assistant' && visible.at(-1)?.content
          ) && (
            <TypingIndicator
              variant={variant}
              actionLabel={actionLabel}
              replayKey={visible.at(-1)?.id}
            />
          )}
      </div>
    </div>
  )
})

export default MessageList
