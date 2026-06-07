/**
 * `ChatAssistant` — inline „wyspa" asystenta AI w lewej kolumnie feedu,
 * tuż pod widgetem KOMUNIKATY. Wizualnie spójna z `AcademicAnnouncementsWidget`
 * (`BaseCard` + `sectionTitleCls` + `widgetGoldCls`).
 *
 * - Brak FAB-a / bottom-sheetu / portalu — komponent renderuje się inline.
 * - Pełna kontrola stanu czatu przez `useChatStore` (RAM, brak persystencji).
 * - Streaming SSE i `AbortController` opakowane w `useChatSend` (DRY z FAB-em).
 * - Renderowanie wiadomości przez wspólny `MessageList` (wariant `compact`).
 *
 * Komponent samowystarczalny — żadnego prop-drillingu (reguła #6 spec).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { sectionTitleCls, widgetGoldCls } from '../../lib/sidePanelStyles'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import MessageList from './MessageList'

export default function ChatAssistant() {
  const messages = useChatStore((s) => s.messages)
  const isTyping = useChatStore((s) => s.isTyping)
  const clearHistory = useChatStore((s) => s.clearHistory)
  const { sendMessage, cancel } = useChatSend()

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

  const handleClear = useCallback(() => {
    cancel()
    clearHistory()
  }, [cancel, clearHistory])

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

  const canClear = messages.length > 0 || isTyping

  return (
    <BaseCard
      variant="default"
      className="animate-glow-halo flex h-[460px] flex-col gap-3 overflow-hidden p-4"
      data-active={isTyping ? 'true' : undefined}
    >
      <div className="flex items-center gap-2">
        <Sparkles
          size={13}
          strokeWidth={2}
          className={`${widgetGoldCls} shrink-0 ${isTyping ? 'animate-sparkle-breathe' : ''}`}
        />
        <span className={`${sectionTitleCls} flex-1 min-w-0`}>Asystent UJ</span>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Wyczyść historię czatu"
          disabled={!canClear}
          className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/4 hover:text-zinc-800 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/4 dark:hover:text-zinc-100"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      <MessageList
        ref={scrollRef}
        messages={messages}
        isTyping={isTyping}
        variant="compact"
        className="scrollbar-thin scrollbar-thumb-zinc-800"
      />

      <form
        onSubmit={onSubmitForm}
        className="flex items-end gap-2 border-t border-zinc-200/70 pt-2 dark:border-white/10"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDownTextarea}
          placeholder="Napisz wiadomość..."
          rows={1}
          disabled={isTyping}
          className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-zinc-200 bg-white/80 px-2.5 py-1.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/15 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:focus:border-brand-gold-bright dark:focus:ring-brand-gold-bright/20"
        />
        <button
          type="submit"
          aria-label="Wyślij wiadomość"
          disabled={isTyping || draft.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-950"
        >
          <Send size={14} strokeWidth={2} />
        </button>
      </form>
    </BaseCard>
  )
}
