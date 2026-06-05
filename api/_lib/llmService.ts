/**
 * LLMService — serwerowy switch providera AI (Edge runtime).
 *
 * Wybór providera per `NODE_ENV`:
 * - `production`: wymagany `GROQ_API_KEY` → `GroqProvider`. Brak klucza =
 *   natychmiastowy rzut przy starcie funkcji (lepsze niż ciche 502).
 * - inne (`development`, `test`, undefined): jeśli `GROQ_API_KEY` jest, też
 *   używamy `GroqProvider` (żeby dev mógł testować realne odpowiedzi);
 *   jeśli klucza brak — wpinamy `MockProvider`, który zwraca pojedynczy
 *   chunk SSE z echo userskiej wiadomości. Dzięki temu UI da się klikać
 *   bez klucza, a parser SSE klienta nadal dostaje strumień w spodziewanym
 *   formacie OpenAI.
 *
 * Eksportujemy gotową instancję `llmService` — `api/chat.ts` jej używa.
 */

import { GroqProvider, GroqProviderError } from './GroqProvider.js'
import type { ChatRequestMessage, GroqMessage, LLMProvider } from './types.js'

/**
 * Polityka retry dla wywołań Groq API.
 *
 * - `GROQ_RETRY_ATTEMPTS` = 3: łącznie do trzech prób (1 oryginalna + 2 retry).
 * - `GROQ_RETRY_DELAY_MS` = 500: stały backoff między próbami. Świadomie BEZ
 *   exponential — Groq przy 429 i 5xx zwykle wraca w <2s, a w Edge runtime
 *   nie chcemy ciągnąć request handlera w nieskończoność.
 *
 * Retry obejmuje:
 * - 429 (rate limit / quota — Groq czasem zwraca po krótkiej chwili),
 * - 5xx (przejściowe błędy infry Groqa),
 * - błędy transportu z `fetch` (DNS, ECONNRESET, abort), tj. wszystko co
 *   NIE jest `GroqProviderError` z 4xx innym niż 429.
 *
 * Retry NIE obejmuje:
 * - 4xx innych niż 429 — to błędy żądania (bad auth, bad model, bad body),
 *   ponawianie ich tylko marnuje czas i kwotę.
 */
const GROQ_RETRY_ATTEMPTS = 3
const GROQ_RETRY_DELAY_MS = 500

/**
 * Błąd warstwy `LLMService` — zawsze mapuje się na HTTP 500 po stronie API.
 *
 * Używany po wyczerpaniu retry lub gdy wystąpił nieoczekiwany wyjątek
 * spoza `GroqProviderError`. Caller (`api/*.ts`) może wykryć ten typ i
 * zwrócić Response z `status: 500`, niezależnie od oryginalnego błędu Groqa.
 */
export class LlmServiceError extends Error {
  readonly status = 500
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'LlmServiceError'
    this.cause = cause
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableGroqError(err: unknown): boolean {
  if (err instanceof GroqProviderError) {
    const status = err.status
    if (status === null) return true
    if (status === 429) return true
    if (status >= 500 && status < 600) return true
    return false
  }
  return true
}

/**
 * Retry helper dla wywołań Groq API (chat completions / stream).
 *
 * Wzorzec: try-catch wokół `groq.chat.completions.create` (tu reprezentowane
 * przez `GroqProvider.sendMessage` / `completeWithTools`). Po wyczerpaniu prób
 * lub przy 4xx-nie-429 rzucamy `LlmServiceError`, który caller mapuje na HTTP 500.
 *
 * Zachowanie zgodne z OpenAI SDK retry semantics: nie retry'ujemy 4xx (poza
 * 429), retry'ujemy 5xx + transport errors + 429.
 */
export async function withGroqRetry<T>(
  fn: () => Promise<T>,
  attempts: number = GROQ_RETRY_ATTEMPTS,
  delayMs: number = GROQ_RETRY_DELAY_MS,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const retryable = isRetryableGroqError(err)
      const isLast = attempt >= attempts
      console.warn(
        '[LLMService] Groq call failed (attempt',
        attempt,
        'of',
        attempts,
        ') retryable:',
        retryable,
        '— err:',
        err instanceof Error ? err.message : String(err),
      )
      if (!retryable || isLast) break
      await sleep(delayMs)
    }
  }
  throw new LlmServiceError(
    lastError instanceof Error
      ? `Groq API call failed after ${attempts} attempts: ${lastError.message}`
      : `Groq API call failed after ${attempts} attempts`,
    lastError,
  )
}

/**
 * Akademicka persona UJverse — wstrzykiwana JAKO PIERWSZY `system`-message
 * przy każdym chacie. Świadomie zdefiniowana w warstwie `LLMService` (a nie
 * w `GroqProvider`), żeby:
 *
 * - `GroqProvider` pozostał czystym vendor-clientem (testowalny, łatwo go
 *   przepiąć na inny provider OpenAI-compatible);
 * - inne use-case'y (np. `scrape-wziks.ts` z własnym strict-mode parserem
 *   nazwisk) mogły instancjonować `GroqProvider` bezpośrednio i NIE
 *   dziedziczyć persony, która by im zaśmieciła output.
 *
 * Skondensowana po przejściu na Function Calling: enumerację narzędzi i
 * parametrów modelowi i tak dostarcza pole `tools` requestu (`toGroqToolsArray()`),
 * więc wcześniejsza długa lista w prompcie była redundantna i kosztowała
 * tokeny przy każdym round-tripie pętli.
 */
export const UJVERSE_SYSTEM_PROMPT =
  'Jesteś asystentem UJverse. Używaj narzędzi do danych. Odpowiadaj zwięźle, akademicko.'

/**
 * Helper dla tool-aware orchestratora (`api/chat.ts`): wkłada personę jako
 * pierwszy `system` message i filtruje wszelkie inne `system`-y z wejścia
 * (klient nie może podmienić instrukcji modelu).
 */
export function withPersona(messages: GroqMessage[]): GroqMessage[] {
  const withoutSystem = messages.filter((m) => m.role !== 'system')
  return [{ role: 'system', content: UJVERSE_SYSTEM_PROMPT }, ...withoutSystem]
}

/** Provider awaryjny: nie woła sieci, generuje minimalny SSE OpenAI-like. */
class MockProvider implements LLMProvider {
  async sendMessage(
    messages: ChatRequestMessage[],
  ): Promise<ReadableStream<Uint8Array>> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const echo = lastUser?.content ?? '(brak treści użytkownika)'
    const reply = `[MockProvider] Otrzymałem: "${echo.slice(0, 200)}"`

    // Imitujemy format OpenAI streaming: jeden `data:` z `delta.content`,
    // potem `data: [DONE]`. Parser klienta (`BielikAdapter.parseSSEStream`)
    // konsumuje to bez modyfikacji.
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
      'data: [DONE]\n\n',
    ]
    const encoder = new TextEncoder()
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
        controller.close()
      },
    })
  }
}

class LLMService implements LLMProvider {
  private readonly provider: LLMProvider

  constructor() {
    const apiKey = process.env.GROQ_API_KEY
    const env = process.env.NODE_ENV

    if (env === 'production') {
      if (!apiKey) {
        throw new Error(
          'LLMService: GROQ_API_KEY is required when NODE_ENV=production',
        )
      }
      this.provider = new GroqProvider(apiKey)
      return
    }

    // dev / test / undefined — preferuj realny provider gdy klucz jest,
    // w przeciwnym razie zjedź na mocka (offline, brak klucza w `.env.local`).
    this.provider = apiKey ? new GroqProvider(apiKey) : new MockProvider()
  }

  async sendMessage(
    messages: ChatRequestMessage[],
  ): Promise<ReadableStream<Uint8Array>> {
    // Persona zawsze idzie na pozycji 0. Klient (`ContextInjectedBielikAdapter`
    // w `src/services/ai/`) może dorzucić swój własny `system` z kontekstem
    // RAG — ląduje on po personie (czyli na pozycji 1), co jest zgodne z
    // OpenAI-compat: model konsumuje wiele `system`-ów łącząc je w jeden
    // kontekst, persona pozostaje "twardszą" instrukcją bo idzie pierwsza.
    const withPersona: ChatRequestMessage[] = [
      { role: 'system', content: UJVERSE_SYSTEM_PROMPT },
      ...messages,
    ]
    // try-catch wokół wywołania Groqa (analogiczne do
    // `groq.chat.completions.create` w oficjalnym SDK) z retry (3 próby, 500ms).
    // Po wyczerpaniu prób / przy 4xx-nie-429 dostajemy `LlmServiceError`
    // mapujące na HTTP 500 w caller-zie.
    try {
      return await withGroqRetry(() => this.provider.sendMessage(withPersona))
    } catch (err) {
      if (err instanceof LlmServiceError) throw err
      throw new LlmServiceError(
        err instanceof Error ? err.message : 'Unknown LLM provider error',
        err,
      )
    }
  }
}

export const llmService: LLMProvider = new LLMService()
