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

import { forwardRef, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '../../types/ai'
import type { Profile } from '../../types'
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
  return (
    <span className={`${BOT_BADGE_CLS} ${sizeClass}`} aria-hidden>
      <AnimatedBot size={size} strokeWidth={2} intensity="idle" />
    </span>
  )
}

function MessageBubble({
  message,
  variant,
  isStreaming,
  myProfile,
  displayName,
}: {
  message: ChatMessage
  variant: MessageListVariant
  isStreaming: boolean
  myProfile?: Profile | null
  displayName?: string
}) {
  const isUser = message.role === 'user'
  const isEmptyAssistant =
    message.role === 'assistant' && message.content.length === 0
  if (isEmptyAssistant) return null

  const tokens = VARIANT_TOKENS[variant]

  if (isUser) {
    const userName = myProfile?.full_name ?? displayName ?? 'Ty'
    return (
      <div className={`flex items-start justify-end ${tokens.rowGap}`}>
        <div
          className={`${tokens.userMax} ${USER_BUBBLE_CLS} ${tokens.userPad} ${tokens.text}`}
        >
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        </div>
        <UserAvatar
          profile={myProfile}
          name={userName}
          className={`${tokens.avatar} mt-0.5`}
          textSize={tokens.avatarText}
        />
      </div>
    )
  }

  return (
    <div className={`flex items-start ${tokens.rowGap}`}>
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
        </div>
      </div>
    </div>
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

function TypingIndicator({ variant }: { variant: MessageListVariant }) {
  const tokens = VARIANT_TOKENS[variant]
  return (
    <div
      className={`flex items-center ${tokens.rowGap}`}
      aria-live="polite"
      aria-label="Asystent myśli"
    >
      <BotBadge size={tokens.botIcon} sizeClass={tokens.avatar} />
      <span
        aria-hidden
        className="flex items-center gap-1 text-logo-navy dark:text-brand-gold-bright"
      >
        {TYPING_DOT_DELAYS.map((delay) => (
          <motion.span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-current"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }}
          />
        ))}
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
          visible.map((m, idx) => {
            const isLastAssistant =
              m.role === 'assistant' && idx === visible.length - 1
            return (
              <MessageBubble
                key={m.id}
                message={m}
                variant={variant}
                isStreaming={isLastAssistant && isTyping}
                myProfile={myProfile}
                displayName={displayName}
              />
            )
          })
        )}
        {isTyping && <TypingIndicator variant={variant} />}
      </div>
    </div>
  )
})

export default MessageList
