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
 * Header parity z innymi wyspami: zero akcji ikonowych po prawej stronie
 * (wszystkie sąsiednie widgety — Komunikaty, Niezbędnik, Koła — mają „czysty"
 * nagłówek). Czyszczenie historii dostępne jako tekstowy link „Nowa rozmowa"
 * w stopce, analogicznie do „Zobacz wszystkie" w `StudentClubsWidget`.
 *
 * Quick prompts: 3 perystentne chipsy nad MessageList → klik wysyła
 * od razu (pattern ChatGPT/Claude). Trzymane lokalnie, świadomie nie
 * w `src/lib/`, żeby nie podkusiły do zaciągnięcia w mobilny FAB.
 *
 * Komponent samowystarczalny — żadnego prop-drillingu (reguła #6 spec).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import {
  sectionTitleCls,
  sideHeaderLinkCls,
  sideMutedCls,
  sidePanelHoverFocus,
  widgetGoldCls,
} from '../../lib/sidePanelStyles'
import type { Profile } from '../../types'
import { CHAT_MODEL_LABEL } from '../../lib/chatModel'
import { useChatStore } from '../../store/useChatStore'
import { useChatSend } from '../../hooks/useChatSend'
import AnimatedBot from './AnimatedBot'
import MessageList from './MessageList'

const OPEN_HUB_BTN_CLS = `shrink-0 rounded-lg px-1.5 py-1 text-xs font-medium ${sideHeaderLinkCls} ${sidePanelHoverFocus}`

/**
 * Quick prompts dobrane tak, żeby KAŻDY 1:1 mapował na konkretne
 * narzędzie z `api/_lib/tools/` z deterministycznym wynikiem, bez
 * wprowadzania modelu w błąd (np. pytanie o WZiKS dla narzędzia bez
 * filtra wydziału prowadziło do halucynacji „mam ogłoszenia z WZiKS"
 * mimo że tool zwraca top 10 bez filtra).
 *
 * Mapowanie:
 * - „Co nowego na feedzie?" → `get_latest_posts`
 * - „Najnowsze ogłoszenia"  → `get_latest_announcements`
 * - „Pokaż konferencje"     → `search_events("konferencj")` (5+ trafień
 *   w `official_events` — dobrany pod realny stan bazy 06.2026, gdzie
 *   „juwenalia" nie istnieje, ale konferencji UJ jest sporo)
 * - „Wydarzenia naukowe"    → `search_events("nauk")` (ilike szeroko trafia)
 *
 * KEEP IN SYNC z `ChatHubView.QUICK_PROMPTS` i listą w
 * `scripts/prewarm-chat-cache.ts` (response-cache key normalizuje
 * tekst, więc dosłowna zgodność daje cross-surface cache hit).
 */
const QUICK_PROMPTS = [
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Pokaż konferencje',
  'Wydarzenia naukowe',
] as const

type Props = {
  /** Profil zalogowanego użytkownika — awatar przy jego wiadomościach. */
  myProfile?: Profile | null
  /** Display name — fallback dla awatara (inicjał), gdy `myProfile` brak. */
  displayName?: string
  /**
   * Override domyślnej klasy wysokości wyspy. Default `h-[460px]` używamy gdy
   * komponent żyje samodzielnie; gdy parent (FeedView) wyrównuje wyspy lewej
   * kolumny do wysokości prawego asiede, podaje tu `h-full` i kontroluje
   * rozmiar wrapperem (flex basis).
   */
  heightClassName?: string
}

export default function ChatAssistant({
  myProfile,
  displayName,
  heightClassName = 'h-[460px]',
}: Props = {}) {
  const navigate = useNavigate()
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
      className={`flex ${heightClassName} min-h-0 flex-col gap-3 overflow-hidden p-4`}
    >
      <div className="flex items-center gap-2">
        <AnimatedBot
          size={16}
          strokeWidth={2}
          intensity={isTyping ? 'active' : 'idle'}
          className={`${widgetGoldCls} shrink-0`}
        />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={sectionTitleCls}>Asystent UJverse</span>
          <span className={`text-[10px] ${sideMutedCls}`}>{CHAT_MODEL_LABEL}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className={OPEN_HUB_BTN_CLS}
          aria-label="Otwórz pełny widok rozmowy z asystentem"
        >
          Otwórz pełny czat →
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Szybkie pytania">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void handleSend(prompt)}
            disabled={isTyping}
            className="rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#1e293b] backdrop-blur-md transition-colors hover:border-[#1e293b]/30 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950/50 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/70"
          >
            {prompt}
          </button>
        ))}
      </div>

      <MessageList
        ref={scrollRef}
        messages={messages}
        isTyping={isTyping}
        variant="compact"
        className="scrollbar-thin scrollbar-thumb-zinc-800"
        myProfile={myProfile}
        displayName={displayName}
      />

      {canClear && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Nowa rozmowa
          </button>
        </div>
      )}

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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-[#1e293b] backdrop-blur-md transition-colors hover:border-[#1e293b]/30 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950/50 dark:text-brand-gold-bright dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/70"
        >
          <Send size={14} strokeWidth={2} />
        </button>
      </form>
    </BaseCard>
  )
}
