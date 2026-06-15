/**
 * `useChatSend` — wspólna logika wysyłania wiadomości do asystenta AI.
 *
 * Używany przez dwie powierzchnie UI:
 * - `ChatAssistant` (desktop, inline wyspa w `FeedView`)
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

/**
 * System-prompt nie jest tu już budowany ręcznie — buduje go
 * `ContextInjectedBielikAdapter` (RAG-Lite) zaraz przed wysłaniem żądania,
 * wstrzykując aktualny kontekst (ogłoszenia + ostatnie posty) z `DataService`.
 * Dzięki temu hook nie wie, że pod spodem siedzi dekorator — kontrakt LLMProvider.
 */

export type UseChatSendResult = {
  sendMessage: (rawContent: string) => Promise<void>
  cancel: () => void
}

export function useChatSend(): UseChatSendResult {
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  useEffect(() => () => cancel(), [cancel])

  const sendMessage = useCallback(
    async (rawContent: string): Promise<void> => {
      const content = rawContent.trim()
      const store = useChatStore.getState()
      if (!content || store.isTyping) return

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

      try {
        const stream = await LLMService.sendMessage(historyForApi, {
          signal: controller.signal,
        })
        for await (const event of LLMService.parseSSEStream(stream)) {
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
          useChatStore.getState().appendAssistantMessage(event.content)
        }
      } catch (err) {
        if (controller.signal.aborted) return
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
        toast.error('Asystent nie odpowiada. Spróbuj ponownie.')
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        useChatStore.getState().setTyping(false)
        // Etykieta ma sens tylko podczas „myślenia" — gdy stream kończy się,
        // typewriter już animuje pełną odpowiedź; trzymanie label'u rozprasza.
        useChatStore.getState().setActionLabel(null)
      }
    },
    [cancel],
  )

  return { sendMessage, cancel }
}
