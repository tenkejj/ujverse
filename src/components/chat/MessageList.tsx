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
}

type VariantTokens = {
  text: string
  pad: string
  bubbleMax: string
}

const VARIANT_TOKENS: Record<MessageListVariant, VariantTokens> = {
  compact: { text: 'text-sm', pad: 'px-3 py-2', bubbleMax: 'max-w-[95%]' },
  roomy: { text: 'text-base', pad: 'px-4 py-2.5', bubbleMax: 'max-w-[85%]' },
}

function MessageBubble({
  message,
  variant,
  isStreaming,
}: {
  message: ChatMessage
  variant: MessageListVariant
  isStreaming: boolean
}) {
  const isUser = message.role === 'user'
  const isEmptyAssistant =
    message.role === 'assistant' && message.content.length === 0
  if (isEmptyAssistant) return null

  const tokens = VARIANT_TOKENS[variant]
  const userMax = variant === 'compact' ? 'max-w-[90%]' : 'max-w-[85%]'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? `${userMax} rounded-xl rounded-br-md border border-[#1e293b]/30 bg-[#1e293b]/80 ${tokens.pad} ${tokens.text} text-white shadow-sm backdrop-blur-md dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/85 dark:text-zinc-950`
            : `${tokens.bubbleMax} rounded-xl rounded-bl-md border border-zinc-200/70 bg-white/60 ${tokens.pad} ${tokens.text} text-zinc-900 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-100`
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        ) : (
          <div className="space-y-1 leading-relaxed">
            <TypewriterMarkdown
              content={message.content}
              isStreaming={isStreaming}
            />
          </div>
        )}
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
  const botSize = variant === 'compact' ? 18 : 22
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Asystent myśli">
      <div
        className={`inline-flex items-center gap-2.5 rounded-xl rounded-bl-md border border-zinc-200/70 bg-white/60 ${tokens.pad} text-[#1e293b] shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-brand-gold-bright`}
      >
        <AnimatedBot size={botSize} strokeWidth={2} intensity="active" className="shrink-0" />
        <span aria-hidden className="flex items-center gap-1">
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
    </div>
  )
}

function DefaultEmptyState({ variant }: { variant: MessageListVariant }) {
  const isCompact = variant === 'compact'
  const title = isCompact ? 'text-base' : 'text-lg'
  const subtitle = isCompact ? 'text-xs' : 'text-sm'
  const iconSize = isCompact ? 44 : 64
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
      <AnimatedBot
        size={iconSize}
        strokeWidth={1.6}
        intensity="wave"
        className="text-[#1e293b] dark:text-brand-gold-bright"
      />
      <p className={`${title} font-medium text-zinc-700 dark:text-zinc-200`}>
        Cześć! W czym mogę pomóc?
      </p>
      <p className={`${subtitle} leading-snug text-zinc-500 dark:text-zinc-400`}>
        Pytaj o terminy, regulaminy, podpowiedzi nauki.
      </p>
    </div>
  )
}

const MessageList = forwardRef<HTMLDivElement, Props>(function MessageList(
  { messages, isTyping, variant = 'compact', emptyState, className },
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
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop
      stickToBottomRef.current = distance <= STICK_TO_BOTTOM_TOLERANCE_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
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
  }, [])

  const visible = messages.filter((m) => m.role !== 'system')
  return (
    <div
      ref={setContainerRef}
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 ${className ?? ''}`}
    >
      <div ref={contentRef} className="flex min-h-full flex-col space-y-3">
        {visible.length === 0 ? (
          // `flex-1` zapewnia, że `DefaultEmptyState` (h-full) dostaje
          // definitywną wysokość wewnątrz flex-column wrappera.
          <div className="flex-1">
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
