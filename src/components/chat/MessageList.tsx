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
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Pencil, RefreshCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ChatMessage } from '../../types/ai'
import type { Profile } from '../../types'
import { toast } from '../../lib/appToast'
import { useChatFeedback } from '../../hooks/useChatFeedback'
import UserAvatar from '../UserAvatar'
import AnimatedBot from './AnimatedBot'
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
   * thinking-phrases. `null` lub `undefined` = fallback do rotujących fraz.
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
}

type VariantTokens = {
  text: string
  userPad: string
  userMax: string
  /** Średnica okrągłego awatara/badge w klasach Tailwind (`h-N w-N`). */
  avatar: string
  /** Rozmiar ikony bota wewnątrz badge (px). */
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
    botIcon: 15,
    avatarText: 'text-[11px]',
    rowGap: 'gap-2',
  },
  roomy: {
    text: 'text-base',
    userPad: 'px-4 py-2.5',
    userMax: 'max-w-[72%]',
    avatar: 'h-8 w-8',
    botIcon: 17,
    avatarText: 'text-xs',
    rowGap: 'gap-2.5',
  },
}

/**
 * Filozofia wizualna (Claude / ChatGPT 2026 + UJverse brand):
 *
 * - **Assistant**: brak dymka. Tekst odpowiedzi rozlewa się jak akapit
 *   dokumentu (lepiej dla markdown-u: nagłówków, list, code-blocków).
 *   Rolę identyfikuje okrągły brand-glass badge z `AnimatedBot` po lewej.
 *
 * - **User**: solidny brand-kafelek po prawej, jedna systemowa para:
 *   - Light: `bg-logo-navy text-white` (slate-800 na kremowym tle = mocny kontrast).
 *   - Dark:  `bg-brand-gold-bright text-zinc-950` — ten sam systemowy gold
 *     co Send button w `ChatHubView` (`dark:bg-brand-gold-bright dark:text-zinc-950`).
 *     Daje wizualne sprzężenie „naciskasz → kafelek się pojawia w tym samym kolorze",
 *     a `bg-logo-navy` w dark schodziło na `#0f172a` i zlewało się z czarnym `--bg-app`.
 *   Avatar z `UserAvatar` po prawej.
 *
 * - **Avatar badges**: ta sama średnica (compact 28px, roomy 32px), żeby
 *   wiersze user/assistant trzymały spójną siatkę pionową.
 *
 * Wszystkie kolory pochodzą z systemowych tokenów (`logo-navy`,
 * `brand-gold-bright`, `fg-primary`, `bg-card`) zdefiniowanych w `index.css`
 * przez `@theme` — auto-adaptacja light/dark bez `dark:` overridów.
 */
const USER_BUBBLE_CLS =
  'rounded-2xl bg-logo-navy text-white shadow-md ' +
  'dark:bg-brand-gold-bright dark:text-zinc-950 dark:shadow-lg'

const ASSISTANT_TEXT_CLS = 'text-fg-primary'

const BOT_BADGE_CLS =
  'inline-flex items-center justify-center rounded-full shrink-0 ' +
  'border border-logo-navy/30 bg-bg-card text-logo-navy ' +
  'dark:border-brand-gold-bright/30 dark:bg-bg-card dark:text-brand-gold-bright'

function BotBadge({ size, sizeClass }: { size: number; sizeClass: string }) {
  const iconSize = Math.round(size * 0.78)
  return (
    <span className={`${BOT_BADGE_CLS} ${sizeClass}`} aria-hidden>
      <AnimatedBot size={iconSize} intensity="idle" />
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
  transition: { duration: 0.28, ease: 'easeOut' as const },
}

const BUBBLE_MOTION_ASSISTANT = {
  initial: { opacity: 0, x: -8, y: 4 },
  animate: { opacity: 1, x: 0, y: 0 },
  transition: { duration: 0.32, ease: 'easeOut' as const },
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
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
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
      className={`group/bubble flex items-start ${tokens.rowGap}`}
      {...BUBBLE_MOTION_ASSISTANT}
    >
      <span className="mt-0.5">
        <BotBadge size={tokens.botIcon} sizeClass={tokens.avatar} />
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
  showRetry,
  onRetry,
}: {
  message: ChatMessage
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
      <button
        type="button"
        onClick={() => void vote(message, 'up')}
        title={feedback === 'up' ? 'Cofnij ocenę' : 'Dobra odpowiedź'}
        aria-label={feedback === 'up' ? 'Cofnij pozytywną ocenę' : 'Oceń pozytywnie'}
        aria-pressed={feedback === 'up'}
        className={`${baseBtn} ${feedback === 'up' ? activeBtn : ''}`}
      >
        <ThumbsUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => void vote(message, 'down')}
        title={feedback === 'down' ? 'Cofnij ocenę' : 'Słaba odpowiedź'}
        aria-label={feedback === 'down' ? 'Cofnij negatywną ocenę' : 'Oceń negatywnie'}
        aria-pressed={feedback === 'down'}
        className={`${baseBtn} ${feedback === 'down' ? activeBtn : ''}`}
      >
        <ThumbsDown size={12} />
      </button>
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
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mt-2.5 flex flex-wrap gap-1.5"
      role="group"
      aria-label="Sugerowane pytania"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onClick(chip)}
          className="rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-logo-navy/40 hover:bg-zinc-50 hover:text-logo-navy dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-brand-gold-bright/40 dark:hover:bg-zinc-800 dark:hover:text-brand-gold-bright"
        >
          {chip}
        </button>
      ))}
    </motion.div>
  )
}

/**
 * Typing indicator — ikonka Bota animowana w framer-motion + trzy mini-kropki
 * pulsujące sekwencyjnie. Bez tekstu — sama animacja niesie informację, że
 * asystent myśli (language-agnostic, kompaktowe).
 *
 * Animacja Bota: breathing scale (1 → 1.12 → 1) + delikatny wobble rotation
 * (-4° → 4° → -4°) w 1.6s loop. Subtelny "thinking" gest — głowa robota
 * lekko się kiwa, jakby rozważała odpowiedź.
 *
 * Trzy kropki: opacity 0.25 → 1 → 0.25 z delay 0/200/400ms — płynniej niż
 * stary `animate-pulse` (framer-motion easing zamiast CSS keyframe ramp).
 *
 * `prefers-reduced-motion` — framer-motion automatycznie respektuje
 * `MotionConfig`-ową heurystykę; dodatkowo dla pewności dajemy
 * `aria-label="Asystent myśli"` żeby screen reader miał kontekst nawet
 * gdy nie widzi animacji.
 */
const TYPING_DOT_DELAYS = [0, 0.2, 0.4] as const

/**
 * Frazy „myślenia" — rotują co ~1.4s podczas streamingu, dając wrażenie
 * że asystent faktycznie wykonuje konkretną pracę zamiast „stoi i myśli".
 * Świadomie LUŹNE i konwersacyjne (zgodnie z tonem UJverse), nie
 * korporacyjne („Performing query...").
 *
 * Krótkie (bez kropek na końcu — kropki dorzucamy jako oddzielną animację
 * kropek). Każda fraza ma 2-4 słowa, max ~24 znaki, żeby zmieściła się
 * w obu wariantach (compact 14px, roomy 16px).
 */
const THINKING_PHRASES: readonly string[] = [
  'Versuś myśli',
  'Sekundka',
  'Już lecę',
  'Patrzę co tam',
  'Daj chwilę',
  'Łapię to',
  'Zaraz coś rzucę',
  'Już prawie',
  'Robi się',
  'Moment',
] as const

function TypingIndicator({
  variant,
  actionLabel,
}: {
  variant: MessageListVariant
  actionLabel: string | null
}) {
  const tokens = VARIANT_TOKENS[variant]

  // Rotacja fraz co ~1.6s. Pierwszą frazę losujemy raz na mount, żeby
  // dwa kolejne loading-state'y nie zaczynały od „Już patrzę" (wrażenie
  // świeżości).
  const initialIdx = useMemo(
    () => Math.floor(Math.random() * THINKING_PHRASES.length),
    [],
  )
  const [phraseIdx, setPhraseIdx] = useState(initialIdx)
  useEffect(() => {
    // Jeśli serwer dał konkretną etykietę („Sprawdzam zniżki…"), nie
    // rotujemy — pokazujemy ją 1:1, bo niesie informację, a nie tylko
    // wypełnia ciszę.
    if (actionLabel) return
    const id = window.setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % THINKING_PHRASES.length)
    }, 1600)
    return () => window.clearInterval(id)
  }, [actionLabel])
  // `actionLabel` ma priorytet — gdy serwer wie którego narzędzia używa,
  // user dostaje konkret, a nie generyczne „Już patrzę".
  const phrase = actionLabel ?? THINKING_PHRASES[phraseIdx]

  const phraseSizeCls = variant === 'compact' ? 'text-xs' : 'text-sm'

  return (
    <div
      className={`flex items-center ${tokens.rowGap}`}
      aria-live="polite"
      aria-label="Asystent myśli"
    >
      <BotBadge size={tokens.botIcon} sizeClass={tokens.avatar} />
      <span
        aria-hidden
        className={`flex items-center gap-1.5 ${phraseSizeCls} text-fg-secondary`}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={phrase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="italic"
          >
            {phrase}
          </motion.span>
        </AnimatePresence>
        <span className="flex items-center gap-1 text-logo-navy dark:text-brand-gold-bright">
          {TYPING_DOT_DELAYS.map((delay) => (
            <motion.span
              key={delay}
              className="h-1 w-1 rounded-full bg-current"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.05, 0.85] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay,
              }}
            />
          ))}
        </span>
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
  const iconSize = isCompact ? 36 : 48
  const badgeSize = isCompact ? 'h-16 w-16' : 'h-24 w-24'
  const minH = isCompact ? 'min-h-56' : 'min-h-80'
  return (
    <div
      className={`flex ${minH} h-full flex-col items-center justify-center gap-4 px-4 py-6 text-center`}
    >
      <span
        aria-hidden
        className={`inline-flex ${badgeSize} items-center justify-center rounded-full border border-logo-navy/25 bg-logo-navy/4 text-logo-navy shadow-sm dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/6 dark:text-brand-gold-bright`}
      >
        <AnimatedBot size={iconSize} strokeWidth={1.6} intensity="wave" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={`${title} font-semibold text-fg-primary`}>
          Cześć! W czym mogę pomóc?
        </p>
        <p
          className={`${subtitle} mx-auto max-w-xs leading-snug text-fg-secondary`}
        >
          Wiem co dziś dzieje się na UJ — pytaj śmiało.
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
    if (!scrollable) return
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop
      stickToBottomRef.current = distance <= STICK_TO_BOTTOM_TOLERANCE_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollable])

  useEffect(() => {
    if (!scrollable) return
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return
      container.scrollTop = container.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollable])

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
            ? 'flex min-h-full flex-col space-y-3'
            : 'flex flex-col space-y-3'
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
        {isTyping && <TypingIndicator variant={variant} actionLabel={actionLabel} />}
      </div>
    </div>
  )
})

export default MessageList
