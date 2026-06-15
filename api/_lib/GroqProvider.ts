/**
 * GroqProvider — `LLMProvider` używający Groq Cloud (OpenAI-compatible API).
 *
 * - Model: konfigurowalny przez argument konstruktora (`model`). Domyślny
 *   fallback `llama-3.1-8b-instant` pozostawiony dla backward-compat (testy
 *   i `scrape-wziks.ts` które same nie podają modelu). Produkcyjna ścieżka
 *   wstrzykuje `DEFAULT_GROQ_MODEL` z `llmService.ts` — patrz tam po
 *   uzasadnienie wyboru pod kątem RPM/RPD.
 * - Streaming: `stream: true` → Groq zwraca SSE w formacie OpenAI
 *   (`data: { choices: [{ delta: { content } }] }`), kompatybilnym z
 *   parserem klienta (`BielikAdapter.parseSSEStream`). Stąd brak konwersji
 *   po naszej stronie — `ReadableStream<Uint8Array>` puszczamy 1:1.
 * - Błąd transportu (sieć/DNS/abort): natywny rzut z `fetch`, propagowany
 *   wyżej do `api/chat.ts`.
 * - Błąd modelu (HTTP 4xx/5xx): rzucamy `GroqProviderError` z `status` —
 *   `api/chat.ts` zamienia go na właściwą odpowiedź HTTP.
 *
 * Klucz API trafia do konstruktora (DI), nigdy nie jest czytany ze
 * środowiska wewnątrz tej klasy — to upraszcza testy i nie wiąże providera
 * z konkretnym runtimem.
 */

import type {
  ChatRequestMessage,
  GroqAssistantMessage,
  GroqMessage,
  LLMProvider,
} from './types.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/**
 * Fallback dla starych call-site'ów które nie podają jawnie modelu w
 * konstruktorze (np. testy, scraper). Główna ścieżka chatu wstrzykuje
 * `DEFAULT_GROQ_MODEL` z `llmService.ts`.
 */
const FALLBACK_MODEL = 'llama-3.1-8b-instant'
const DEFAULT_TEMPERATURE = 0.7

/**
 * Sufity dla `max_tokens` — pilnują żeby model nie generował romansów
 * po naszych krótkich tool-flow odpowiedziach.
 *
 * - `MAX_TOKENS_TOOL_DECISION` — round-trip "zdecyduj jakie tool wywołać".
 *   Model w naszej architekturze albo wybiera tool_call (krótki JSON), albo
 *   pisze odpowiedź na small-talk (~30-100 tok). 300 to bezpieczny sufit.
 *
 * - `MAX_TOKENS_TEXT_REPLY` — fallback dla zwykłej rozmowy (bez tooli).
 *   Trochę większy budżet, gdy model musi coś własnymi słowami napisać.
 *
 * Cap NIE wpływa na finalną odpowiedź dla narzędzi — formatujemy je
 * server-side w `formatToolResultAsFinalAnswer`, więc model nigdy nie
 * "syntetyzuje" wyniku. Płynnie redukuje to output tokeny.
 */
const MAX_TOKENS_TOOL_DECISION = 320
const MAX_TOKENS_TEXT_REPLY = 480

/**
 * Modele "reasoning" — w trakcie generacji emitują chain-of-thought
 * w blokach `<think>...</think>` PRZED finalną odpowiedzią. Domyślnie
 * Groq zwraca te bloki inline w `choices[0].message.content`, co dla
 * naszego chatu = "thought leak" widoczny dla użytkownika.
 *
 * Dla tych modeli wysyłamy `reasoning_format: 'hidden'` — Groq strip-uje
 * reasoning po swojej stronie i `content` zawiera już samą odpowiedź.
 * Dla modeli bez reasoning (llama-3.1-8b) ten parametr nie jest potrzebny
 * i z ostrożności go nie wysyłamy (Groq go ignoruje, ale niektóre
 * OpenAI-compat klony mogłyby się zachłysnąć).
 */
function supportsReasoningFormat(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.includes('qwen3') ||
    m.includes('qwen-3') ||
    m.includes('deepseek-r1') ||
    m.includes('deepseek/r1')
  )
}

/**
 * Format `tools` przekazywany do Groqa (OpenAI-compatible) — `Tool` jako
 * unknown w typie, bo nie chcemy w tym module zależeć od `api/_lib/tools/`.
 * `chat.ts` (orchestrator) podaje gotową tablicę z `toGroqToolsArray()`.
 */
export type GroqToolDescriptor = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: unknown
  }
}

export class GroqProviderError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GroqProviderError'
    this.status = status
  }
}

/** Kształt odpowiedzi Groq w trybie non-streaming (OpenAI-compat). */
type GroqChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

/**
 * Kształt odpowiedzi Groq w trybie non-streaming dla pętli Function Calling
 * — `message` może zawierać albo `content` (finalna odpowiedź), albo
 * `tool_calls` (model prosi o uruchomienie narzędzi), albo oba (rzadkie,
 * ale OpenAI-compat to dopuszcza).
 *
 * `usage` jest obecne dla `stream: false` (Groq zwraca je inline w body).
 * Dla `stream: true` Groq dostarcza usage w ostatnim chunku z `[DONE]` —
 * tej ścieżki na razie nie czytamy (proxy stream jest 1:1 dla starych callerów).
 */
type GroqChatCompletionWithToolsResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: GroqAssistantMessage
  }>
  usage?: GroqUsage
  model?: string
}

export type GroqUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

/**
 * Wynik `completeWithTools`: wiadomość + telemetria użycia + identyfikator
 * modelu, którego faktycznie użył Groq. `model` zwraca Groq w odpowiedzi —
 * jeśli kiedyś zmienimy `MODEL` constans, audit wciąż wskaże co naprawdę
 * obsłużyło request.
 */
export type GroqCompleteWithToolsResult = {
  message: GroqAssistantMessage
  usage: GroqUsage | null
  model: string
}

export type GroqCompleteOptions = {
  /** Niska wartość (0–0.2) dla zadań deterministycznych: parsery, klasyfikacja. */
  temperature?: number
}

export type GroqCompleteWithToolsOptions = {
  temperature?: number
  /** OpenAI-compat: 'auto' (default) | 'none' | { type:'function', function:{name} }. */
  toolChoice?: 'auto' | 'none'
  /**
   * Override modelu per call — przydatne gdy chcemy lekką ścieżkę
   * (`llama-3.1-8b-instant`) dla small-talku, a domyślny `qwen3-32b`
   * tylko gdy faktycznie tools są w grze.
   * Default: model z konstruktora.
   */
  model?: string
  /**
   * Override `max_tokens` per call. Domyślnie `MAX_TOKENS_TOOL_DECISION`,
   * dla small-talk można wziąć mniejszy budżet (200) — model i tak nie
   * potrzebuje więcej dla „cześć / dzięki".
   */
  maxTokens?: number
}

/**
 * Pojedynczy element strumienia z `streamCompletion`. Trzy warianty:
 *  - `delta`: kolejny kawałek `content` (token-by-token od Groqa)
 *  - `done`: koniec strumienia + telemetria (usage / model — Groq emituje
 *    je w ostatnim chunku PRZED `[DONE]`)
 *  - `error`: błąd parsingu lub abort. Klient powinien przerwać konsumpcję
 *    i pokazać fallback.
 */
export type GroqStreamChunk =
  | { type: 'delta'; content: string }
  | { type: 'done'; usage: GroqUsage | null; model: string | null }
  | { type: 'error'; message: string }

export type GroqStreamCompletionOptions = GroqCompleteWithToolsOptions

export class GroqProvider implements LLMProvider {
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model: string = FALLBACK_MODEL) {
    if (!apiKey) {
      throw new Error('GroqProvider: apiKey is required')
    }
    this.apiKey = apiKey
    this.model = model
  }

  async sendMessage(
    messages: ChatRequestMessage[],
  ): Promise<ReadableStream<Uint8Array>> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: MAX_TOKENS_TEXT_REPLY,
    }
    if (supportsReasoningFormat(this.model)) {
      body.reasoning_format = 'hidden'
    }
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new GroqProviderError(
        text ? `Groq API ${response.status}: ${text.slice(0, 500)}` : `Groq API returned ${response.status}`,
        response.status,
      )
    }

    if (!response.body) {
      throw new GroqProviderError('Groq API returned empty body', response.status)
    }

    return response.body
  }

  /**
   * Wariant non-streaming dla cron-jobów i parserów (np. `scrape-wziks.ts`):
   * zwraca pełen `string` z `choices[0].message.content` po jednym round-tripie.
   * Świadomie poza interfejsem `LLMProvider` — to inny use-case (JSON, niski
   * `temperature`, brak persony), a kontrakt `LLMProvider` celowo trzymamy
   * skupiony na streamingu czatu.
   *
   * Błąd HTTP → `GroqProviderError` ze statusem (caller może rozróżnić 429).
   * Pusta odpowiedź modelu → `GroqProviderError` bez statusu.
   */
  async completeJson(
    messages: ChatRequestMessage[],
    opts: GroqCompleteOptions = {},
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: MAX_TOKENS_TEXT_REPLY,
    }
    if (supportsReasoningFormat(this.model)) {
      body.reasoning_format = 'hidden'
    }
    const response = await this.postJson(body)

    const data = (await response.json().catch(() => null)) as GroqChatCompletionResponse | null
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw new GroqProviderError('Groq API returned empty content', null)
    }
    return content
  }

  /**
   * Tool-aware non-streaming completion (Function Calling).
   *
   * Używane przez orchestrator w `api/chat.ts` w pętli rozwiązywania narzędzi:
   * - przekazuje `tools` (z `toGroqToolsArray()`) i `tool_choice: 'auto'`,
   * - zwraca `choices[0].message`, które może zawierać:
   *   - `content` (finalna odpowiedź modelu) — pętla się kończy,
   *   - `tool_calls[]` (model prosi o uruchomienie narzędzi) — orchestrator
   *     wykonuje egzekutory i wraca z wynikami jako wiadomości `role: 'tool'`,
   *   - oba (rzadkie, ale dopuszczalne) — orchestrator preferuje tool_calls.
   *
   * Świadomie BEZ streamingu — w tool loop streaming komplikuje parsowanie
   * `tool_calls` (delta-based) i nie daje UX-owej wartości (użytkownik widzi
   * dopiero finalną odpowiedź). Streaming zostawiamy ostatniemu krokowi
   * (synthesized SSE w `api/chat.ts`).
   */
  async completeWithTools(
    messages: GroqMessage[],
    tools: GroqToolDescriptor[],
    opts: GroqCompleteWithToolsOptions = {},
  ): Promise<GroqCompleteWithToolsResult> {
    const effectiveModel = opts.model ?? this.model
    const body: Record<string, unknown> = {
      model: effectiveModel,
      messages,
      stream: false,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxTokens ?? MAX_TOKENS_TOOL_DECISION,
    }
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = opts.toolChoice ?? 'auto'
    }
    // `reasoning_format` zależy od MODELU faktycznie wysyłanego, nie od
    // domyślnego z konstruktora — gdy override'em zjeżdżamy z qwen3 na
    // llamę 8b, nie chcemy wysłać parametru, którego mała llama nie zna.
    if (supportsReasoningFormat(effectiveModel)) {
      body.reasoning_format = 'hidden'
    }

    const response = await this.postJson(body)
    const data = (await response.json().catch(() => null)) as GroqChatCompletionWithToolsResponse | null

    const message = data?.choices?.[0]?.message
    if (!message) {
      throw new GroqProviderError('Groq API returned no message', null)
    }

    return {
      message,
      usage: data?.usage ?? null,
      model: data?.model ?? effectiveModel,
    }
  }

  /**
   * Streaming wariant `completeWithTools` — używany gdy chcemy emitować
   * delty do klienta w locie (synthesis Llama 8B). Zwraca AsyncIterable
   * `GroqStreamChunk`:
   *
   *   for await (const chunk of provider.streamCompletion(...)) {
   *     if (chunk.type === 'delta') write(chunk.content)
   *     if (chunk.type === 'done') logUsage(chunk.usage)
   *   }
   *
   * Świadomie zwracamy AsyncIterable (a nie raw `ReadableStream<Uint8Array>`)
   * — caller (orchestrator) potrzebuje sparsowanych delts żeby (a) bufforować
   * do KV cache (b) sprawdzić markdown guard. Surowy stream wymagałby
   * podwójnego parsingu (klient + cache layer).
   *
   * Tools są dopuszczalne ale w naszej obecnej ścieżce streamingowej (czyli
   * syntezator) zawsze idą jako []. Zostawione w API dla spójności z
   * `completeWithTools` i ewentualnego streamingowego tool-flow w przyszłości.
   *
   * NIE używamy `withGroqRetry` tutaj — retry SSE jest skomplikowany (już
   * wysłaliśmy nagłówki do klienta, nie można cofnąć). Caller decyduje:
   * można wrap'ować całą sekcję `for await` w try-catch i fallback do
   * non-streaming `completeWithTools` przy błędzie.
   */
  async *streamCompletion(
    messages: GroqMessage[],
    tools: GroqToolDescriptor[],
    opts: GroqStreamCompletionOptions = {},
  ): AsyncGenerator<GroqStreamChunk, void, void> {
    const effectiveModel = opts.model ?? this.model
    const body: Record<string, unknown> = {
      model: effectiveModel,
      messages,
      stream: true,
      // OpenAI-compat: gdy `stream: true`, Groq emituje usage w ostatnim
      // chunku tylko gdy poprosimy explicit `stream_options.include_usage`.
      stream_options: { include_usage: true },
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxTokens ?? MAX_TOKENS_TOOL_DECISION,
    }
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = opts.toolChoice ?? 'auto'
    }
    if (supportsReasoningFormat(effectiveModel)) {
      body.reasoning_format = 'hidden'
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new GroqProviderError(
        text
          ? `Groq API ${response.status}: ${text.slice(0, 500)}`
          : `Groq API returned ${response.status}`,
        response.status,
      )
    }

    if (!response.body) {
      throw new GroqProviderError('Groq API returned empty body', response.status)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    // SSE lines mogą przyjść w chunkach niepełnych — buforujemy ogon do
    // pierwszego `\n\n` (separator OpenAI/Groq SSE).
    let buffer = ''
    let usage: GroqUsage | null = null
    let modelEcho: string | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Każde zdarzenie SSE kończy się pustą linią (`\n\n`). Procesujemy
        // wszystkie kompletne zdarzenia, ogon zostawiamy w `buffer`.
        let sep = buffer.indexOf('\n\n')
        while (sep !== -1) {
          const event = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          sep = buffer.indexOf('\n\n')
          // Filtrujemy `data:` linie z eventu. SSE w teorii może mieć też
          // `event:` / `id:` / `:comment` — Groq ich nie używa, ignorujemy.
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (payload === '[DONE]') {
              yield { type: 'done', usage, model: modelEcho ?? effectiveModel }
              return
            }
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string | null } }>
                usage?: GroqUsage
                model?: string
              }
              if (parsed.model && !modelEcho) {
                modelEcho = parsed.model
              }
              if (parsed.usage) {
                usage = parsed.usage
              }
              const delta = parsed.choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta.length > 0) {
                yield { type: 'delta', content: delta }
              }
            } catch (parseErr) {
              // Pojedyncza linia parseError nie wywraca strumienia — Groq
              // czasem wysyła pustyhardbeat lub `:` comment. Logujemy
              // warn i lecimy dalej.
              console.warn(
                '[GroqProvider.streamCompletion] failed to parse SSE payload, skipping:',
                parseErr instanceof Error ? parseErr.message : parseErr,
              )
            }
          }
        }
      }
      // Nigdy nie dostaliśmy `[DONE]` — Groq zerwał połączenie. Emitujemy
      // done z tym co mamy (caller dostaje sygnał że można zamknąć stream).
      yield { type: 'done', usage, model: modelEcho ?? effectiveModel }
    } finally {
      // Defensive cleanup — anulujemy reader na wypadek wyjątku z caller'a
      // (np. klient zamknął SSE w pół drogi). Bez tego stream-by-stream
      // wisiałby w pamięci do GC.
      try {
        reader.cancel().catch(() => {})
      } catch {
        // ignore
      }
    }
  }

  private async postJson(body: Record<string, unknown>): Promise<Response> {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new GroqProviderError(
        text
          ? `Groq API ${response.status}: ${text.slice(0, 500)}`
          : `Groq API returned ${response.status}`,
        response.status,
      )
    }

    return response
  }
}
