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
 */

import { forwardRef, type ReactNode } from 'react'
import { Bot } from 'lucide-react'
import type { ChatMessage } from '../../types/ai'
import TypewriterMarkdown from './TypewriterMarkdown'

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
  compact: { text: 'text-xs', pad: 'px-2.5 py-1.5', bubbleMax: 'max-w-[95%]' },
  roomy: { text: 'text-sm', pad: 'px-3 py-2', bubbleMax: 'max-w-[85%]' },
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

const TYPING_DOT_DELAYS_MS = [0, 150, 300] as const

function TypingIndicator({ variant }: { variant: MessageListVariant }) {
  const tokens = VARIANT_TOKENS[variant]
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Asystent pisze">
      <div
        className={`flex items-center gap-1 rounded-xl rounded-bl-md border border-zinc-200/70 bg-white/60 ${tokens.pad} text-[#1e293b] shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-brand-gold-bright`}
      >
        {TYPING_DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function DefaultEmptyState({ variant }: { variant: MessageListVariant }) {
  const title = variant === 'compact' ? 'text-xs' : 'text-sm'
  const subtitle = variant === 'compact' ? 'text-[11px]' : 'text-xs'
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
      <Bot
        size={variant === 'compact' ? 32 : 40}
        strokeWidth={1.6}
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
  ref,
) {
  const visible = messages.filter((m) => m.role !== 'system')
  return (
    <div
      ref={ref}
      className={`min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 ${className ?? ''}`}
    >
      {visible.length === 0 ? (
        (emptyState ?? <DefaultEmptyState variant={variant} />)
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
  )
})

export default MessageList
