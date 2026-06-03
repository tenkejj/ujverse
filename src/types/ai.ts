/**
 * Typy modułu AI (efemeryczny czat asystenta).
 * Wydzielone z `src/types/index.ts` (legacy domena), analogicznie do
 * `src/types/content.ts`. Brak persystencji w DB → brak rekordów DB.
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  /** Lokalne UUID — generowane przez store; nigdy nie trafia do bazy. */
  id: string
  role: ChatRole
  content: string
  /** `Date.now()` ms — kolejność wiadomości w RAM-ie. */
  createdAt: number
}

/**
 * Kontrakt konfiguracji czatu. Pola opcjonalne — backend trzyma sensowne
 * defaulty (model Bielik-11B, temperature 0.7).
 */
export type ChatConfig = {
  model: string
  temperature?: number
  maxTokens?: number
  /** Pozwala UI anulować streaming (np. `clearHistory` / unmount). */
  signal?: AbortSignal
}

/**
 * Provider LLM. Zwraca surowy `ReadableStream<Uint8Array>` z odpowiedzią SSE
 * oraz wystawia parser SSE jako część kontraktu — dzięki temu dekoratory
 * (np. `ContextInjectedBielikAdapter`) mogą delegować parsowanie do bazowego
 * adaptera bez wycieku typu konkretnej implementacji do konsumenta.
 */
export interface LLMProvider {
  sendMessage(
    messages: ChatMessage[],
    config?: Partial<ChatConfig>,
  ): Promise<ReadableStream<Uint8Array>>
  parseSSEStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<string, void, void>
}

/**
 * Payload wysyłany do `/api/chat` — pochodna `ChatMessage` zawierająca tylko
 * pola, które backend potrzebuje przepuścić do OpenRouter.
 */
export type ChatRequestMessage = {
  role: ChatRole
  content: string
}

export type ChatRequestBody = {
  messages: ChatRequestMessage[]
}
