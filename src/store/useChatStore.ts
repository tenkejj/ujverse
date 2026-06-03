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
  addMessage: (msg: NewMessage) => string
  appendAssistantMessage: (chunk: string) => void
  setTyping: (value: boolean) => void
  setError: (value: string | null) => void
  setOpen: (value: boolean) => void
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

  setTyping: (value) => set({ isTyping: value }),
  setError: (value) => set({ error: value }),
  setOpen: (value) => set({ isOpen: value }),

  clearHistory: () => set({ messages: [], error: null, isTyping: false }),
}))
