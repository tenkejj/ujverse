/**
 * Edge endpoint dla AI tasków modułu Aula (streszczenie sali, wyjaśnianie /
 * upraszczanie / tłumaczenie wiadomości).
 *
 * - **Runtime**: Edge (fra1), żeby trzymać low-latency dla wschodu UE.
 * - **Provider**: ten sam `GroqProvider` co `api/chat.ts` (model
 *   `qwen/qwen3-32b` przez env override). NIE używamy `withPersona` — Aula
 *   ma własne, task-specific persona z `aulaAiPrompts.ts`. Klient buduje
 *   payload `{ task, input }` i serwer dispatchuje do builder'a.
 * - **Stream**: Groq odpowiedź jest forwardowana 1:1 (SSE format OpenAI delta),
 *   `BielikAdapter.parseSSEStream` po stronie klienta parsuje to bez zmian.
 *   Jedyna modyfikacja stream → strip `<think>` tags (Qwen3 reasoning leak)
 *   przez pipe-through TransformStream żeby user nie widział wewnętrznych
 *   rozważań modelu (mimo `reasoning_format: 'hidden'` w GroqProvider).
 * - **Auth**: opcjonalna — Bearer JWT identyfikuje usera dla rate-limit
 *   (1 bucket per user; anonim → 1 bucket per IP).
 * - **Rate limit**: bardziej restrykcyjny niż `/api/chat` (10 req/min per
 *   user, refill 6s). AI tasks Aula są typowo „dla siebie" — nie chcemy
 *   żeby ktoś za-spamował endpoint streszczeniem 100x.
 * - **Walidacja payload**: ścisła — niepoprawny shape → 400. Bezpieczna
 *   konwersja do `AulaAiPayload` (czytamy tylko znane pola).
 * - **Brak Function Calling / tools**: Aula AI tasks nie potrzebują danych
 *   z DB (kontekst dostaje od klienta w `input`), więc upraszczamy ścieżkę
 *   do jednego stream-call Groqa.
 */

import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'
import { extractRequestUser } from './_lib/auth.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
} from './_lib/ipRateLimit.js'
import { DEFAULT_GROQ_MODEL } from './_lib/llmService.js'
import {
  buildMessagesForTask,
  type AulaAiPayload,
  type AulaAiTask,
} from '../src/lib/aulaAiPrompts.js'
import type { ChatRequestMessage } from './_lib/types.js'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const RATE_LIMIT_PER_USER = {
  capacity: 10,
  refillSeconds: 6,
}

const ALLOWED_TASKS: ReadonlySet<AulaAiTask> = new Set<AulaAiTask>([
  'summarize_channel',
  'explain_message',
  'simplify_message',
  'translate_message',
])

const ALLOWED_TRANSLATE_LANGS = new Set(['en', 'de', 'es', 'fr', 'uk'])

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Strip `<think>...</think>` ze stringa (Qwen3 / DeepSeek reasoning leak).
 * Mirror `stripThinkingTags` z `api/chat.ts` — nie importujemy tam żeby
 * zachować file-level decoupling (dwa endpointy w pełni niezależne).
 */
function stripThink(text: string): string {
  if (!text) return text
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/<think>[\s\S]*$/i, '')
  return cleaned
}

/**
 * Stream-aware strip `<think>` w SSE chunkach (OpenAI delta format).
 * Bufor trzyma „prawdopodobny otwarty think" żeby nie wysyłać użytkownikowi
 * `<th` zanim model dokleży `ink>`. Strategia:
 *
 *   1. Concat deltę do bufora.
 *   2. Jeśli w buforze JEST domknięty `<think>...</think>`, strip i flush
 *      pre-think + post-think.
 *   3. Jeśli w buforze JEST otwarty `<think>` bez `</think>`, flush wszystko
 *      DO `<think>` i drop resztę (czekamy na zamknięcie).
 *   4. Jeśli bufor kończy się na potencjalny start tagu (`<` lub `<t` …
 *      `<think`), trzymamy końcówkę żeby nie wysyłać niepełnego tagu.
 *   5. W przeciwnym razie flush całego bufora.
 */
function makeThinkStrippingTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let sseBuffer = '' // surowe SSE chunki
  let inThink = false

  const processDeltaText = (raw: string): string => {
    // Stan: outside/inside think. Iteracyjnie scanujemy.
    let out = ''
    let i = 0
    while (i < raw.length) {
      if (inThink) {
        const close = raw.indexOf('</think>', i)
        if (close === -1) {
          // Zostajemy w think, drop reszte
          return out
        }
        i = close + '</think>'.length
        inThink = false
        continue
      }
      const open = raw.indexOf('<think>', i)
      if (open === -1) {
        out += raw.slice(i)
        return out
      }
      out += raw.slice(i, open)
      i = open + '<think>'.length
      inThink = true
    }
    return out
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      sseBuffer += decoder.decode(chunk, { stream: true })

      // SSE jest line-based: każdy event ends with `\n\n`.
      let sepIdx = sseBuffer.indexOf('\n\n')
      while (sepIdx !== -1) {
        const event = sseBuffer.slice(0, sepIdx)
        sseBuffer = sseBuffer.slice(sepIdx + 2)

        const rewritten = rewriteSseEvent(event, processDeltaText)
        if (rewritten !== null) {
          controller.enqueue(encoder.encode(rewritten + '\n\n'))
        }

        sepIdx = sseBuffer.indexOf('\n\n')
      }
    },
    flush(controller) {
      if (sseBuffer.trim()) {
        const rewritten = rewriteSseEvent(sseBuffer, processDeltaText)
        if (rewritten !== null) {
          controller.enqueue(encoder.encode(rewritten))
        }
      }
    },
  })
}

/**
 * Rewrite pojedynczego SSE eventu. Eventy bez `data:` lub `[DONE]` przepuszczamy
 * 1:1. Eventy z `data: { choices: [{ delta: { content } }] }` modyfikujemy —
 * `content` przelatuje przez `processDeltaText`. Zwraca null gdy delta po
 * przepuszczeniu jest pusta (nie chcemy wysyłać "pustych" events).
 */
function rewriteSseEvent(
  event: string,
  process: (text: string) => string,
): string | null {
  const lines = event.split('\n')
  let dataAcc = ''
  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    dataAcc += line.slice(5).trimStart()
  }
  if (!dataAcc) return event // np. komentarze, ping
  if (dataAcc === '[DONE]') return 'data: [DONE]'

  try {
    const parsed = JSON.parse(dataAcc) as {
      choices?: Array<{ delta?: { content?: string | null } }>
    }
    const first = parsed?.choices?.[0]
    const content = first?.delta?.content
    if (typeof content !== 'string') return event // przepuść jak jest

    const stripped = process(content)
    if (!stripped) return null
    if (first && first.delta) first.delta.content = stripped
    return `data: ${JSON.stringify(parsed)}`
  } catch {
    return event
  }
}

function isAulaAiPayload(value: unknown): value is AulaAiPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as { task?: unknown; input?: unknown }
  if (typeof v.task !== 'string') return false
  if (!ALLOWED_TASKS.has(v.task as AulaAiTask)) return false
  if (!v.input || typeof v.input !== 'object') return false

  if (v.task === 'summarize_channel') {
    const inp = v.input as {
      channelName?: unknown
      channelKindLabel?: unknown
      messages?: unknown
    }
    if (typeof inp.channelName !== 'string') return false
    if (
      inp.channelKindLabel !== null &&
      inp.channelKindLabel !== undefined &&
      typeof inp.channelKindLabel !== 'string'
    ) {
      return false
    }
    if (!Array.isArray(inp.messages)) return false
    for (const m of inp.messages) {
      if (!m || typeof m !== 'object') return false
      const mm = m as {
        authorName?: unknown
        content?: unknown
        timestamp?: unknown
      }
      if (typeof mm.authorName !== 'string') return false
      if (typeof mm.content !== 'string') return false
      if (typeof mm.timestamp !== 'string') return false
    }
    return true
  }

  if (v.task === 'translate_message') {
    const inp = v.input as { text?: unknown; targetLang?: unknown }
    if (typeof inp.text !== 'string') return false
    if (inp.targetLang !== undefined) {
      if (
        typeof inp.targetLang !== 'string' ||
        !ALLOWED_TRANSLATE_LANGS.has(inp.targetLang)
      ) {
        return false
      }
    }
    return true
  }

  // explain_message / simplify_message
  const inp = v.input as { text?: unknown; channelName?: unknown }
  if (typeof inp.text !== 'string') return false
  if (inp.channelName !== undefined && typeof inp.channelName !== 'string') {
    return false
  }
  return true
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!isAulaAiPayload(body)) {
    return jsonError(400, 'Invalid payload shape')
  }

  // Auth + rate-limit. Anonim też ma rate-limit — chronimy się przed
  // open-faucetem dla niezalogowanych (na dev jest sens, na prod też).
  const user = await extractRequestUser(req)
  const rateKey = user.userId ? `aula-ai:${user.userId}` : `aula-ai:ip:${extractClientIp(req)}`
  const rate = checkAndConsumeRateLimit(rateKey, RATE_LIMIT_PER_USER)
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Za dużo żądań AI. Spróbuj za ${Math.ceil(rate.retryAfterMs / 1000)}s.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
          ...CORS_HEADERS,
        },
      },
    )
  }

  // Build LLM messages dla danego taska.
  const messages: ChatRequestMessage[] = buildMessagesForTask(body)

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    // Bez klucza Groq endpoint jest bezużyteczny. Lepszy explicit błąd niż
    // ciche 500. Klient pokaże toast.
    return jsonError(503, 'AI tymczasowo niedostępne (brak konfiguracji).')
  }

  const provider = new GroqProvider(apiKey, DEFAULT_GROQ_MODEL)
  let upstream: ReadableStream<Uint8Array>
  try {
    upstream = await provider.sendMessage(messages)
  } catch (err) {
    if (err instanceof GroqProviderError) {
      if (err.status === 429) {
        return jsonError(429, 'System przeciążony. Spróbuj za chwilę.')
      }
      return jsonError(err.status ?? 500, `AI error: ${err.message}`)
    }
    return jsonError(500, 'Unexpected AI error')
  }

  // Strip `<think>` w locie + forward jako SSE 1:1 dla klienta. Klient
  // używa `BielikAdapter.parseSSEStream` żeby dostać same delty.
  const output = upstream.pipeThrough(makeThinkStrippingTransform())

  return new Response(output, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      ...CORS_HEADERS,
    },
  })
}

/** Eksportowane do testów — nie używać w UI. */
export const __internal = {
  isAulaAiPayload,
  stripThink,
  rewriteSseEvent,
}
