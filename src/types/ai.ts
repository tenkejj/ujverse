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
  /**
   * Sugerowane follow-up actions (chipy) dla TEJ wiadomości — przyszło z
   * SSE meta-eventu. Renderowane pod ostatnią assistant message; klik =
   * wstawienie tekstu chipa do composera + send. Tylko dla `role: 'assistant'`.
   * `undefined` = brak chipów (np. small-talk, fast-path bez toola).
   */
  chips?: readonly string[]
  /**
   * Nazwa toola który serwer wykonał dla TEJ odpowiedzi (z meta-eventu).
   * Używana przez quality feedback (POST do `/api/chat-feedback` z `tool:`)
   * żeby dashboard mógł sortować oceny per-tool. `undefined` = small-talk
   * albo brak meta-eventu.
   */
  tool?: string | null
  /**
   * Ocena usera dla tej wiadomości (kciuk górno/dół). Optymistyczna —
   * ustawiana lokalnie zanim POST do `/api/chat-feedback` zwróci. Brak =
   * brak oceny.
   */
  feedback?: 'up' | 'down' | null
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
/**
 * Zdarzenia wyciągane z SSE — `delta` to kawałek odpowiedzi assistant'a
 * (do dopisania do bieżącej wiadomości), `meta` to kontekstowy hint typu
 * „aktualnie wykonuję narzędzie X" (do pokazania w typing-indicator zamiast
 * losowych „Myślę…"). Server może wysłać `meta` w każdym momencie strumienia,
 * ale w praktyce robi to PRZED pierwszym `delta`.
 */
export type ParsedSSEEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'meta'
      tool: string
      label: string
      /** Klikalne sugestie follow-up („Tylko jedzenie", „Co jutro?"). */
      chips?: readonly string[]
    }

export interface LLMProvider {
  sendMessage(
    messages: ChatMessage[],
    config?: Partial<ChatConfig>,
  ): Promise<ReadableStream<Uint8Array>>
  parseSSEStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<ParsedSSEEvent, void, void>
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
