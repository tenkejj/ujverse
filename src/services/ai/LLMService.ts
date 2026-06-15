/**
 * LLMService — klient `LLMProvider` rozmawiający z naszą Edge-proxy `/api/chat`.
 *
 * - `sendMessage` wykonuje `POST` i zwraca surowy `ReadableStream<Uint8Array>`
 *   z odpowiedzią SSE OpenRouter (przepuszczoną przez nasz proxy).
 * - `parseSSEStream` to AsyncIterable, który dekoduje chunki w formacie
 *   `data: { choices: [{ delta: { content } }] }` i wypluwa same delty
 *   tekstowe — gotowe do `appendAssistantMessage` w storze.
 *
 * Eksportujemy `BielikAdapter` (klasa) + singleton `LLMService` (gotowa do
 * użycia instancja). `BielikAdapter` ma sens jako jeden z możliwych
 * `LLMProvider`-ów — w przyszłości można dorobić np. `GPTAdapter` bez
 * zmiany kontraktu konsumentów.
 *
 * Brak `any` — wszystkie kształty walidowane typowanymi guardami.
 */

import type {
  ChatConfig,
  ChatMessage,
  ChatRequestMessage,
  LLMProvider,
  ParsedSSEEvent,
} from '../../types/ai'
import { supabase } from '../../supabaseClient'
// Function Calling po stronie serwera (`api/chat.ts`) zastępuje dekorator
// `ContextInjectedBielikAdapter` — narzędzia pobierają świeże dane z DB
// w trakcie odpowiedzi modelu, więc statyczny RAG-Lite jest zbędny.
// Plik dekoratora zostaje na wypadek powrotu do statycznego kontekstu.

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const DEFAULT_ENDPOINT = `${API_BASE}/api/chat`

export class LLMServiceError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'LLMServiceError'
    this.status = status
  }
}

type OpenRouterDeltaChunk = {
  choices: Array<{ delta?: { content?: string | null } }>
}

type MetaChunk = {
  meta: { tool: string; label: string; chips?: readonly string[] }
}

function isOpenRouterDeltaChunk(value: unknown): value is OpenRouterDeltaChunk {
  if (!value || typeof value !== 'object') return false
  const choices = (value as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return false
  for (const c of choices) {
    if (c && typeof c === 'object') continue
    return false
  }
  return true
}

function isMetaChunk(value: unknown): value is MetaChunk {
  if (!value || typeof value !== 'object') return false
  const meta = (value as { meta?: unknown }).meta
  if (!meta || typeof meta !== 'object') return false
  const m = meta as { tool?: unknown; label?: unknown; chips?: unknown }
  if (typeof m.tool !== 'string' || typeof m.label !== 'string') return false
  if (m.chips !== undefined) {
    if (!Array.isArray(m.chips)) return false
    if (!m.chips.every((c) => typeof c === 'string')) return false
  }
  return true
}

function extractDelta(chunk: OpenRouterDeltaChunk): string {
  const first = chunk.choices[0]
  if (!first) return ''
  const content = first.delta?.content
  return typeof content === 'string' ? content : ''
}

export class BielikAdapter implements LLMProvider {
  private readonly endpoint: string

  constructor(endpoint: string = DEFAULT_ENDPOINT) {
    this.endpoint = endpoint
  }

  async sendMessage(
    messages: ChatMessage[],
    config?: Partial<ChatConfig>,
  ): Promise<ReadableStream<Uint8Array>> {
    const payload: { messages: ChatRequestMessage[] } = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }

    // Function Calling po stronie serwera respektuje user_id (logowanie + scope
    // narzędzi). Forwardujemy dostępny access_token jako Bearer; jeśli sesji
    // brak — proxy potraktuje request anonimowo (tools dostają `userId: null`).
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
      }
    } catch (err) {
      console.warn('[BielikAdapter] failed to read supabase session:', err)
    }

    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: config?.signal,
      })
    } catch (err) {
      // Sieć padła PRZED dostarczeniem odpowiedzi (DNS, CORS preflight,
      // abort, brak `vercel dev` na :3000). Logujemy do konsoli przeglądarki,
      // żeby F12 → Console pokazywała pełen obiekt błędu, a nie tylko message.
      console.error('[BielikAdapter] fetch error:', err, 'endpoint:', this.endpoint)
      const msg = err instanceof Error ? err.message : 'Network error'
      throw new LLMServiceError(msg)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(
        '[BielikAdapter] non-OK response status:',
        res.status,
        'body:',
        text.slice(0, 500),
      )
      throw new LLMServiceError(
        text || `Chat endpoint returned ${res.status}`,
        res.status,
      )
    }

    if (!res.body) {
      console.error('[BielikAdapter] empty body, status:', res.status)
      throw new LLMServiceError('Chat endpoint returned empty body', res.status)
    }

    return res.body
  }

  /**
   * AsyncIterable dekodujący SSE OpenRouter (`data: {...}\n\n` + `data: [DONE]`).
   * Buforuje fragmenty linii pomiędzy chunkami i ignoruje wiersze niezgodne
   * z formatem `data: ` (np. komentarze `: ping` od serwera).
   *
   * Yielduje typowane zdarzenia: `delta` (kawałek tekstu) lub `meta`
   * (etykieta aktualnej akcji typu „Sprawdzam zniżki").
   */
  async *parseSSEStream(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<ParsedSSEEvent, void, void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sepIndex = buffer.indexOf('\n\n')
        while (sepIndex !== -1) {
          const event = buffer.slice(0, sepIndex)
          buffer = buffer.slice(sepIndex + 2)

          const parsed = this.consumeEvent(event)
          if (parsed === '__DONE__') return
          if (parsed) yield parsed

          sepIndex = buffer.indexOf('\n\n')
        }
      }

      const tail = buffer.trim()
      if (tail) {
        const parsed = this.consumeEvent(tail)
        if (parsed && parsed !== '__DONE__') yield parsed
      }
    } finally {
      reader.releaseLock()
    }
  }

  private consumeEvent(event: string): ParsedSSEEvent | '__DONE__' | null {
    const lines = event.split('\n')
    let dataAcc = ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trimStart()
      if (payload === '[DONE]') return '__DONE__'
      dataAcc += payload
    }
    if (!dataAcc) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(dataAcc)
    } catch {
      return null
    }

    if (isMetaChunk(parsed)) {
      return {
        type: 'meta',
        tool: parsed.meta.tool,
        label: parsed.meta.label,
        chips: parsed.meta.chips,
      }
    }
    if (isOpenRouterDeltaChunk(parsed)) {
      const content = extractDelta(parsed)
      if (content) return { type: 'delta', content }
    }
    return null
  }
}

/**
 * Singleton używany przez `useChatSend`; ten sam provider wszędzie.
 *
 * Pracujemy z surowym `BielikAdapter` — kontekst (ogłoszenia, wydarzenia,
 * posty) dostarcza Function Calling po stronie serwera (`api/chat.ts` +
 * `api/_lib/tools/`). Klient nie wstrzykuje już RAG-Lite; cały RAG przeniósł
 * się do narzędzi wywoływanych przez model na żądanie.
 *
 * `ContextInjectedBielikAdapter` zostaje w repo na wypadek powrotu do
 * statycznego kontekstu (np. degradacja gdy Groq tools są niedostępne).
 */
export const LLMService: LLMProvider = new BielikAdapter()
