/**
 * Typy serwerowej warstwy AI (Edge runtime).
 *
 * Świadomie odseparowane od `src/types/ai.ts` (klient/Vite bundle), żeby
 * uniknąć importów krzyżowych klient ↔ Edge i wycieku jakichkolwiek symboli
 * specyficznych dla przeglądarki (`import.meta.env`, DOM lib) do funkcji
 * uruchamianej po stronie Vercel Edge.
 *
 * Kontrakt: `sendMessage` zwraca surowy `ReadableStream<Uint8Array>` — proxy
 * `api/chat.ts` przepuszcza go 1:1 do klienta jako `text/event-stream`,
 * dzięki czemu klient (`BielikAdapter.parseSSEStream`) nie wie, co siedzi
 * pod spodem (Groq, OpenRouter, mock).
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatRequestMessage = {
  role: ChatRole
  content: string
}

export interface LLMProvider {
  sendMessage(messages: ChatRequestMessage[]): Promise<ReadableStream<Uint8Array>>
}

/**
 * Wiadomości używane w pętli Function Calling (tool-aware).
 *
 * Świadomie odseparowane od `ChatRequestMessage` (streaming chat) — w tool
 * loop musimy modelować:
 * - `assistant` z `tool_calls[]` (model prosi o uruchomienie narzędzia),
 * - `tool` z `tool_call_id` (wynik egzekutora wraca do modelu),
 * - kontent `null` dla wiadomości assistant, która tylko rozpoczyna tool calls.
 *
 * Format jest 1:1 z OpenAI/Groq Chat Completions API.
 */
export type GroqToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    /** Argumenty zserializowane jako JSON string (zgodnie z OpenAI/Groq). */
    arguments: string
  }
}

export type GroqSystemMessage = { role: 'system'; content: string }
export type GroqUserMessage = { role: 'user'; content: string }
export type GroqAssistantMessage = {
  role: 'assistant'
  /** `null` gdy model wystawia tylko `tool_calls` bez tekstu. */
  content: string | null
  tool_calls?: GroqToolCall[]
}
export type GroqToolMessage = {
  role: 'tool'
  content: string
  tool_call_id: string
  name?: string
}

export type GroqMessage =
  | GroqSystemMessage
  | GroqUserMessage
  | GroqAssistantMessage
  | GroqToolMessage
