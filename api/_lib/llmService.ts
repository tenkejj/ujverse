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
 * Domyślny model Groqa dla całej platformy. Świadomy wybór pod kątem
 * **RPM** na free tier (źródło: console.groq.com/docs/rate-limits, czerwiec 2026):
 *
 * | Model                       | RPM | RPD    | TPM   |
 * | --------------------------- | --- | ------ | ----- |
 * | llama-3.1-8b-instant (stary)|  30 | 14 400 |  6 K  |
 * | qwen/qwen3-32b (nowy)       |  60 |  1 000 |  6 K  |
 * | moonshotai/kimi-k2-instruct |  60 |  1 000 | 10 K  |
 *
 * Wybieramy `qwen/qwen3-32b` — dwa razy wyższy RPM, dla UJverse RPD nie jest
 * bottleneckiem (oczekiwany ruch znacznie poniżej 1K zapytań/dobę). Burst
 * 60 RPM bezpośrednio obniża szansę na 429 podczas typowego użycia z kilkoma
 * równoczesnymi userami.
 *
 * Override przez `process.env.GROQ_MODEL` (np. szybki rollback na llama-8b
 * gdy zaobserwujemy regres jakości / problem z Function Calling) — żeby nie
 * trzeba było wdrażać kodu, tylko zmienić env w panelu Vercela.
 */
export const DEFAULT_GROQ_MODEL: string =
  process.env.GROQ_MODEL ?? 'qwen/qwen3-32b'

/**
 * Lekki model dla ścieżki SMALL-TALK (gdy `routeIntent`/`shouldUseTools`
 * uznał że tools nie są potrzebne — „cześć", „dzięki", „jak się masz").
 *
 * Po co osobny model:
 *  - qwen3-32b reasoning-aware (drogo + wolno) — dla 4-słownej grzeczności
 *    to zabicie muchy granatem;
 *  - llama-3.1-8b-instant: ~5× tańszy, ~3× szybszy w TTFB, kontekst 128k
 *    jak qwen — dla małej rozmowy w PL daje porównywalną jakość;
 *  - reasoning_format niewysyłany (llama go nie wspiera, ale nie potrzebuje
 *    — `supportsReasoningFormat` w `GroqProvider` rozróżnia per call).
 *
 * Override przez env `GROQ_SMALLTALK_MODEL` — zostawia furtkę żeby
 * przerzucić się na inny tani model bez deploya kodu.
 */
export const GROQ_SMALLTALK_MODEL: string =
  process.env.GROQ_SMALLTALK_MODEL ?? 'llama-3.1-8b-instant'

/**
 * Polityka retry dla wywołań Groq API.
 *
 * - `GROQ_RETRY_ATTEMPTS` = 3: łącznie do trzech prób (1 oryginalna + 2 retry).
 * - `GROQ_RETRY_DELAY_MS` = 500: bazowy delay, mnożony wykładniczo dla 429
 *   i 5xx (`delay = baseDelay * 2^attempt`). Stały delay nie wystarczał przy
 *   limicie zapytań NA MINUTĘ — Groq potrafi zwracać kolejne 429 w odstępach
 *   <500ms, a nasze retry tylko zwiększało nacisk. Exponential + jitter
 *   rozprasza próbki w czasie i daje kwocie szansę się odbudować.
 * - `GROQ_RETRY_MAX_DELAY_MS` = 8000: hard-cap pojedynczego sleep-u. Edge
 *   functions na Vercelu mają limit ~10–25s na request — wyjście poza ten
 *   budżet pojedynczym backoff-em zabija UX bardziej niż samo 429.
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
const GROQ_RETRY_MAX_DELAY_MS = 8000

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
 * Wylicza delay między próbami z formułą exponential backoff + jitter.
 *
 *   base = delayMs * 2^attempt              (np. 500ms → 1000ms → 2000ms → 4000ms)
 *   capped = min(base, GROQ_RETRY_MAX_DELAY_MS)
 *   final = capped * (0.5 + Math.random())  (jitter w przedziale [0.5×, 1.5×))
 *
 * Jitter rozprasza retry-e w czasie — bez niego N równolegle uruchomionych
 * requestów wszystkie czekałyby ten sam czas i waliłyby Groqa zsynchronizowanie,
 * pogłębiając rate limit (klasyczny "thundering herd"). Z jitterem każdy z
 * tych requestów wraca w innym momencie i kwota Groqa zdąży się odbudować.
 *
 * `attempt` (1, 2, 3, ...) to numer próby która właśnie się NIE powiodła —
 * delay wyznacza ile poczekać PRZED kolejną próbą.
 */
export function computeBackoffDelay(
  delayMs: number,
  attempt: number,
  maxDelayMs: number = GROQ_RETRY_MAX_DELAY_MS,
): number {
  const exponential = delayMs * Math.pow(2, attempt)
  const capped = Math.min(exponential, maxDelayMs)
  const jittered = capped * (0.5 + Math.random())
  return Math.max(0, Math.floor(jittered))
}

/**
 * Retry helper dla wywołań Groq API (chat completions / stream).
 *
 * Wzorzec: try-catch wokół `groq.chat.completions.create` (tu reprezentowane
 * przez `GroqProvider.sendMessage` / `completeWithTools`). Po wyczerpaniu prób
 * lub przy 4xx-nie-429 rzucamy `LlmServiceError`, który caller mapuje na HTTP 500.
 *
 * Strategia backoff: exponential (`delayMs * 2^attempt`) z jitterem
 * (`× (0.5 + Math.random())`) — patrz `computeBackoffDelay`. Stosujemy to
 * dla WSZYSTKICH retryowalnych błędów (nie tylko 429), bo 5xx również często
 * pojawiają się w seriach i ten sam mechanizm działa jako rozpraszacz.
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
      const status = err instanceof GroqProviderError ? err.status : null
      console.warn(
        '[LLMService] Groq call failed (attempt',
        attempt,
        'of',
        attempts,
        ') status:',
        status,
        'retryable:',
        retryable,
        '— err:',
        err instanceof Error ? err.message : String(err),
      )
      if (!retryable || isLast) break
      const backoffMs = computeBackoffDelay(delayMs, attempt)
      console.warn(
        '[LLMService] backoff (exponential + jitter):',
        backoffMs,
        'ms before retry',
        attempt + 1,
        status === 429 ? '(429 rate-limit recovery)' : '',
      )
      await sleep(backoffMs)
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
import { UJVERSE_SYSTEM_PROMPT } from './persona.js'

export { UJVERSE_SYSTEM_PROMPT }

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
      this.provider = new GroqProvider(apiKey, DEFAULT_GROQ_MODEL)
      return
    }

    // dev / test / undefined — preferuj realny provider gdy klucz jest,
    // w przeciwnym razie zjedź na mocka (offline, brak klucza w `.env.local`).
    this.provider = apiKey
      ? new GroqProvider(apiKey, DEFAULT_GROQ_MODEL)
      : new MockProvider()
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
