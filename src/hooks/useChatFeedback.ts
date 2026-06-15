/**
 * `useChatFeedback` — wysylanie oceny (kciuk gora/dol) assistant message
 * do `/api/chat-feedback`.
 *
 * UX:
 *  - Optymistyczne: store update natychmiast (`setMessageFeedback`),
 *    POST leci w tle. Klik wraca natychmiast nawet przy wolnym networku.
 *  - Toggle: drugi klik tego samego ratingu cofa (DELETE).
 *  - Toast tylko przy bledzie POST-a (sukces silentny - check juz widoczny).
 *
 * Auth:
 *  - Forwardujemy access_token z `supabase.auth.getSession()` jak BielikAdapter.
 *  - Endpoint odrzuca 401 dla anonima - hook pokazuje toast i odwraca
 *    optymistyczna zmiane.
 */

import { useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useChatStore } from '../store/useChatStore'
import { toast } from '../lib/appToast'
import type { ChatMessage } from '../types/ai'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const FEEDBACK_ENDPOINT = `${API_BASE}/api/chat-feedback`

export type UseChatFeedbackResult = {
  vote: (message: ChatMessage, value: 'up' | 'down') => Promise<void>
}

export function useChatFeedback(): UseChatFeedbackResult {
  const vote = useCallback(
    async (message: ChatMessage, value: 'up' | 'down'): Promise<void> => {
      if (message.role !== 'assistant' || !message.content) return

      const currentValue = message.feedback ?? null
      // Toggle off: drugi klik tego samego ratingu cofa glos (jak Reddit).
      const targetValue: 'up' | 'down' | null =
        currentValue === value ? null : value

      // Optymistyczna zmiana w store - klik daje natychmiastowy feedback
      // wizualny zanim POST wroci.
      useChatStore.getState().setMessageFeedback(message.id, targetValue)

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        const { data } = await supabase.auth.getSession()
        const accessToken = data.session?.access_token
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`
        } else {
          // Anon - odwracamy optymistyczna zmiane, pokazujemy toast.
          useChatStore.getState().setMessageFeedback(message.id, currentValue)
          toast.error('Zaloguj się, żeby oceniać odpowiedzi.')
          return
        }

        const res = await fetch(FEEDBACK_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messageId: message.id,
            rating: targetValue,
            tool: message.tool ?? null,
          }),
        })

        if (!res.ok) {
          // Cofamy optymistyczna zmiane, pokazujemy toast.
          useChatStore.getState().setMessageFeedback(message.id, currentValue)
          if (res.status === 401) {
            toast.error('Zaloguj się, żeby oceniać odpowiedzi.')
          } else if (res.status === 429) {
            toast.error('Wolniej — za szybko klikasz.')
          } else {
            console.warn(
              '[useChatFeedback] POST failed status:',
              res.status,
              'body:',
              await res.text().catch(() => ''),
            )
            toast.error('Nie udało się zapisać oceny.')
          }
        }
      } catch (err) {
        // Network error - cofamy optymistyczna zmiane.
        useChatStore.getState().setMessageFeedback(message.id, currentValue)
        console.warn('[useChatFeedback] network error:', err)
        toast.error('Brak połączenia — spróbuj jeszcze raz.')
      }
    },
    [],
  )

  return { vote }
}
