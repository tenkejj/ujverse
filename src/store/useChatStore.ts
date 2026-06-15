/**
 * `useChatStore` — pamięć RAM dla efemerycznego czatu AI.
 * Brak `persist` (wymaganie #6: zero zapisu na dysk / w bazie).
 *
 * Konwencja:
 * - `addMessage` zwraca id (przydatne, gdy potrzebujemy referencji do
 *   placeholdera asystenta w trakcie streamingu).
 * - `appendAssistantMessage` immutowalnie dokleja `chunk` do ostatniej
 *   wiadomości `role === 'assistant'`. No-op gdy brak takiej.
 * - `clearHistory` ucina zarówno historię jak i `error` / `isTyping`.
 */

import { create } from 'zustand'
import type { ChatMessage, ChatRole } from '../types/ai'

type NewMessage = {
  role: ChatRole
  content: string
}

type ChatState = {
  messages: ChatMessage[]
  isTyping: boolean
  error: string | null
  /** Stan otwarcia mobilnego bottom-sheetu (FAB). Desktop wyspa nie używa. */
  isOpen: boolean
  /**
   * Krótka etykieta tego, co serwer aktualnie robi (np. „Sprawdzam zniżki…").
   * Ustawiana z meta-eventu w SSE PRZED pierwszym contentem; resetowana gdy
   * zaczyna napływać delta (typing-indicator znika i pojawia się typewriter).
   * `null` = pokaż domyślne thinking-phrases.
   */
  actionLabel: string | null
  addMessage: (msg: NewMessage) => string
  appendAssistantMessage: (chunk: string) => void
  /**
   * Ustawia chipy follow-up dla OSTATNIEJ assistant message. Wywoływane
   * z `useChatSend` gdy SSE meta-event zawiera `chips`. No-op gdy brak
   * assistant message do oznaczenia.
   */
  setLastAssistantChips: (chips: readonly string[]) => void
  setTyping: (value: boolean) => void
  setError: (value: string | null) => void
  setOpen: (value: boolean) => void
  setActionLabel: (value: string | null) => void
  /**
   * Usuwa ostatnią parę user→assistant z historii. Używane przez „Edytuj"
   * (user wraca do composera, assistant do kosza) i „Spróbuj ponownie"
   * (przed re-send'em żeby nie mieć duplikatów). No-op gdy nic do usunięcia.
   *
   * Implementacja: znajdź index ostatniej assistant message, jeśli
   * bezpośrednio przed nią jest user message — wytnij obie. Inaczej tnij
   * tylko assistant (defensywnie). Nie chcemy partial-state tropików.
   */
  removeLastTurn: () => { lastUserText: string | null }
  clearHistory: () => void
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  error: null,
  isOpen: false,
  actionLabel: null,

  addMessage: (msg) => {
    const id = generateId()
    const next: ChatMessage = {
      id,
      role: msg.role,
      content: msg.content,
      createdAt: Date.now(),
    }
    set((state) => ({ messages: [...state.messages, next] }))
    return id
  },

  appendAssistantMessage: (chunk) => {
    if (!chunk) return
    set((state) => {
      let lastIndex = -1
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i]?.role === 'assistant') {
          lastIndex = i
          break
        }
      }
      if (lastIndex === -1) return state
      const target = state.messages[lastIndex]
      if (!target) return state
      const updated: ChatMessage = { ...target, content: target.content + chunk }
      const nextMessages = state.messages.slice()
      nextMessages[lastIndex] = updated
      return { messages: nextMessages }
    })
  },

  setLastAssistantChips: (chips) => {
    set((state) => {
      let lastIndex = -1
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i]?.role === 'assistant') {
          lastIndex = i
          break
        }
      }
      if (lastIndex === -1) return state
      const target = state.messages[lastIndex]
      if (!target) return state
      const updated: ChatMessage = { ...target, chips }
      const nextMessages = state.messages.slice()
      nextMessages[lastIndex] = updated
      return { messages: nextMessages }
    })
  },

  setTyping: (value) => set({ isTyping: value }),
  setError: (value) => set({ error: value }),
  setOpen: (value) => set({ isOpen: value }),
  setActionLabel: (value) => set({ actionLabel: value }),

  removeLastTurn: () => {
    let lastUserText: string | null = null
    set((state) => {
      const msgs = state.messages
      if (msgs.length === 0) return state
      // Index ostatniej assistant message (jeśli jest).
      let lastAssistantIdx = -1
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          lastAssistantIdx = i
          break
        }
      }
      // Index ostatniej user message PRZED assistant (lub w ogóle, gdy
      // assistant brak — np. fail przed pierwszą odpowiedzią).
      const userSearchEnd =
        lastAssistantIdx === -1 ? msgs.length - 1 : lastAssistantIdx - 1
      let lastUserIdx = -1
      for (let i = userSearchEnd; i >= 0; i--) {
        if (msgs[i].role === 'user') {
          lastUserIdx = i
          break
        }
      }
      if (lastUserIdx !== -1) {
        lastUserText = msgs[lastUserIdx].content
      }
      // Wytnij obie (lub jedną jeśli druga brak).
      const drop = new Set<number>()
      if (lastAssistantIdx !== -1) drop.add(lastAssistantIdx)
      if (lastUserIdx !== -1) drop.add(lastUserIdx)
      if (drop.size === 0) return state
      const next = msgs.filter((_, i) => !drop.has(i))
      return { messages: next }
    })
    return { lastUserText }
  },

  clearHistory: () =>
    set({ messages: [], error: null, isTyping: false, actionLabel: null }),
}))
