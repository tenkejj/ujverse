/**
 * `useChatSend` — wspólna logika wysyłania wiadomości do asystenta AI.
 *
 * Używany przez dwie powierzchnie UI:
 * - `ChatAssistant` (desktop, teaser wyspy w `FeedView` → nawigacja do `/chat`)
 * - `ChatAssistantFab` (mobile/tablet, FAB + bottom-sheet w `App.tsx`)
 *
 * Obie powierzchnie współdzielą stan przez `useChatStore`, więc historia
 * pisana w jednym miejscu jest natychmiast widoczna w drugim.
 *
 * `AbortController` ucina aktywny stream przy:
 * - ręcznym `cancel()` (np. `clearHistory`),
 * - unmoutowaniu ostatniego konsumenta hooka.
 */

import { useCallback, useEffect, useRef } from 'react'
import { LLMService, LLMServiceError } from '../services/ai/LLMService'
import { useChatStore } from '../store/useChatStore'
import { toast } from '../lib/appToast'
import type { ChatMessage } from '../types/ai'
import {
  getUserPreferences,
  subscribePreferences,
} from '../lib/userPreferences'

// Persona and tool context are owned by the server.

export type UseChatSendResult = {
  sendMessage: (rawContent: string) => Promise<void>
  cancel: () => void
}

/** A bounded presentation settle, not model inference time or a token-rate metric. */
function settleReceivedText(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (typeof window === 'undefined' || signal.aborted || delayMs <= 0)
    return Promise.resolve()
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches || getUserPreferences().reducedMotion)
    return Promise.resolve()
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribePreferences = () => {}
    const finish = () => {
      if (timer !== undefined) clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      motion.removeEventListener('change', onMotion)
      unsubscribePreferences()
      resolve()
    }
    const onMotion = () => {
      if (motion.matches) finish()
    }
    signal.addEventListener('abort', finish, { once: true })
    motion.addEventListener('change', onMotion)
    unsubscribePreferences = subscribePreferences((prefs) => {
      if (prefs.reducedMotion) finish()
    })
    timer = setTimeout(finish, Math.min(450, delayMs))
  })
}

export function useChatSend(): UseChatSendResult {
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      useChatStore.getState().setTyping(false)
      useChatStore.getState().setActionLabel(null)
      useChatStore.getState().setResponsePhase('idle')
    }
  }, [])

  useEffect(() => () => cancel(), [cancel])
  useEffect(
    () =>
      useChatStore.subscribe((next, prev) => {
        if (next.generation !== prev.generation) cancel()
      }),
    [cancel],
  )

  const sendMessage = useCallback(
    async (rawContent: string): Promise<void> => {
      const content = rawContent.trim()
      const store = useChatStore.getState()
      if (!content || store.isTyping) return

      const generation = store.generation
      // Wymóg #4: AbortController musi uciąć poprzedni stream PRZED rozpoczęciem nowego.
      cancel()
      store.setError(null)

      store.addMessage({ role: 'user', content })
      store.addMessage({ role: 'assistant', content: '' })

      const historyForApi: ChatMessage[] = useChatStore
        .getState()
        .messages.filter((m) => m.role !== 'assistant' || m.content.length > 0)

      const controller = new AbortController()
      abortRef.current = controller
      useChatStore.getState().setTyping(true)
      useChatStore.getState().setResponsePhase('thinking')
      let lastDeltaAt = 0
      let lastDeltaLength = 0

      try {
        const stream = await LLMService.sendMessage(historyForApi, {
          signal: controller.signal,
        })
        for await (const event of LLMService.parseSSEStream(stream)) {
          if (
            controller.signal.aborted ||
            useChatStore.getState().generation !== generation
          ) {
            controller.abort()
            return
          }
          if (event.type === 'meta') {
            // Server zna tool name → pokaż konkretną etykietę („Sprawdzam
            // zniżki…") zamiast losowych thinking-phrases. Zostanie do
            // momentu gdy `appendAssistantMessage` dostanie pierwszy chunk
            // i `isTyping` zostanie zresetowany w `finally`.
            useChatStore.getState().setActionLabel(event.label)
            // Tool name idzie do `ChatMessage.tool` — feedback (kciuk
            // góra/dół) używa go w POST /api/chat-feedback dla per-tool
            // dashboardu.
            useChatStore.getState().setLastAssistantTool(event.tool)
            // Chipy follow-up („Tylko jedzenie", „Co jutro?") przyklejamy
            // do ostatniej assistant message — wyrenderują się pod nią
            // jak skończy się streaming. Drugi meta-event (smart chips
            // z `smartChips.ts`) NADPISUJE statyczne, bo używamy tego
            // samego settera.
            if (event.chips && event.chips.length > 0) {
              useChatStore.getState().setLastAssistantChips(event.chips)
            }
            continue
          }
          if (
            event.content &&
            useChatStore.getState().responsePhase !== 'answering'
          ) {
            useChatStore.getState().setResponsePhase('answering')
          }
          if (event.content) {
            lastDeltaAt = performance.now()
            lastDeltaLength = event.content.length
          }
          useChatStore.getState().appendAssistantMessage(event.content)
        }
        // Ready/cached replies can put a delta and [DONE] in one browser task.
        // Keep answering active just long enough for a short visual reveal,
        // never more than 450ms after the last received delta.
        const settleMs = Math.min(
          450,
          Math.max(80, Math.ceil(lastDeltaLength / 12) * 40),
        )
        if (lastDeltaLength > 0) {
          await settleReceivedText(
            settleMs - (performance.now() - lastDeltaAt),
            controller.signal,
          )
        }
        if (
          controller.signal.aborted ||
          useChatStore.getState().generation !== generation
        )
          return
        const last = useChatStore.getState().messages.at(-1)
        if (
          !controller.signal.aborted &&
          last?.role === 'assistant' &&
          last.content.trim().length === 0
        ) {
          useChatStore.getState().dropTrailingEmptyAssistant()
          useChatStore.getState().setError('Pusta odpowiedź asystenta.')
          useChatStore.getState().setResponsePhase('error')
          toast.error('Asystent nie odpowiada. Spróbuj ponownie.')
        } else if (
          !controller.signal.aborted &&
          last?.role === 'assistant' &&
          last.content.trim()
        ) {
          useChatStore.getState().setResponsePhase('success')
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          useChatStore.getState().generation !== generation
        )
          return
        useChatStore.getState().dropTrailingEmptyAssistant()
        // DEBUG (Krok 3): pełen rzut błędu do F12 → Console.
        // `LLMServiceError` niesie też status HTTP — przydatne, gdy proxy
        // zwróciło 404 (np. brak `vercel dev`), 500 (brak klucza) lub 502
        // (`Proxy Error`).
        if (err instanceof LLMServiceError) {
          console.error(
            '[useChatSend] LLMServiceError:',
            err.message,
            'status:',
            err.status,
          )
        } else {
          console.error('[useChatSend] sendMessage failed:', err)
        }
        const message =
          err instanceof LLMServiceError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Nieznany błąd asystenta.'
        useChatStore.getState().setError(message)
        useChatStore.getState().setResponsePhase('error')
        // 413 (za długa wiadomość) ma konkretny tekst z API — nie zasłaniaj
        // go ogólnym „Asystent nie odpowiada".
        if (err instanceof LLMServiceError && err.status === 413) {
          toast.error(message)
        } else {
          toast.error('Asystent nie odpowiada. Spróbuj ponownie.')
        }
      } finally {
        if (
          abortRef.current === controller &&
          useChatStore.getState().generation === generation
        ) {
          abortRef.current = null
          useChatStore.getState().setTyping(false)
          useChatStore.getState().setActionLabel(null)
        }
      }
    },
    [cancel],
  )

  return { sendMessage, cancel }
}
