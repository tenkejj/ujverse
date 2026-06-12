/**
 * Edge endpoint generujący codzienny "morning brief" dla strony `/dzis`.
 *
 * Różnice względem `api/aula-ai.ts`:
 *   - Inny domain semantyczny (cały user-day, nie tylko Aula).
 *   - Pojedynczy task — payload validation jest węższa.
 *   - Rate limit 5 req/min per user — brief ma sens raz na sesję, hard
 *     throttle żeby user nie spamował "regeneruj" 30x.
 *
 * Wspólne z innymi /api/*-ai endpointami:
 *   - Provider: `GroqProvider` (model `qwen/qwen3-32b` przez env override)
 *   - Stream SSE forwardowany 1:1 do klienta + TransformStream strip
 *     `<think>` (Qwen3 reasoning leak guard)
 *   - Auth opcjonalny (Bearer JWT) — anon też ma rate-limit per IP
 *   - Brak Function Calling — kontekst dostarcza klient w payload
 */

import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'
import { extractRequestUser } from './_lib/auth.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
} from './_lib/ipRateLimit.js'
import { DEFAULT_GROQ_MODEL } from './_lib/llmService.js'
import {
  buildDailyBriefMessages,
  DAILY_BRIEF_LIMITS,
  type DailyBriefInput,
} from '../src/lib/dailyBriefPrompts.js'
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
  capacity: 5,
  refillSeconds: 12,
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Strip `<think>...</think>` w SSE chunkach — kopia z `aula-ai.ts`. Świadomie
 * NIE wyciągamy do shared module: dwa endpointy w pełni niezależne (zmiana
 * w jednym nie powinna wpływać na drugi).
 */
function makeThinkStrippingTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let sseBuffer = ''
  let inThink = false

  const processDeltaText = (raw: string): string => {
    let out = ''
    let i = 0
    while (i < raw.length) {
      if (inThink) {
        const close = raw.indexOf('</think>', i)
        if (close === -1) return out
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
  if (!dataAcc) return event
  if (dataAcc === '[DONE]') return 'data: [DONE]'
  try {
    const parsed = JSON.parse(dataAcc) as {
      choices?: Array<{ delta?: { content?: string | null } }>
    }
    const first = parsed?.choices?.[0]
    const content = first?.delta?.content
    if (typeof content !== 'string') return event
    const stripped = process(content)
    if (!stripped) return null
    if (first && first.delta) first.delta.content = stripped
    return `data: ${JSON.stringify(parsed)}`
  } catch {
    return event
  }
}

/** Walidacja `DailyBriefInput` payload. */
function isDailyBriefInput(value: unknown): value is DailyBriefInput {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<DailyBriefInput>
  if (v.firstName !== null && v.firstName !== undefined && typeof v.firstName !== 'string') {
    return false
  }
  if (typeof v.todayLabel !== 'string') return false
  if (!Array.isArray(v.classes)) return false
  if (!Array.isArray(v.tasks)) return false
  if (!Array.isArray(v.announcements)) return false
  if (v.classes.length > DAILY_BRIEF_LIMITS.MAX_CLASSES) return false
  if (v.tasks.length > DAILY_BRIEF_LIMITS.MAX_TASKS) return false
  if (v.announcements.length > DAILY_BRIEF_LIMITS.MAX_ANNOUNCEMENTS) return false
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

  if (!isDailyBriefInput(body)) {
    return jsonError(400, 'Invalid payload shape')
  }

  const user = await extractRequestUser(req)
  const rateKey = user.userId
    ? `daily-brief:${user.userId}`
    : `daily-brief:ip:${extractClientIp(req)}`
  const rate = checkAndConsumeRateLimit(rateKey, RATE_LIMIT_PER_USER)
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Brief można odświeżyć za ${Math.ceil(rate.retryAfterMs / 1000)}s.`,
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

  const messages: ChatRequestMessage[] = buildDailyBriefMessages(body)

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return jsonError(503, 'Brief tymczasowo niedostępny (brak konfiguracji AI).')
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
