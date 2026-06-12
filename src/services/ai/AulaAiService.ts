/**
 * UJverse — AulaAiService: klient `/api/aula-ai` (streaming SSE).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Trzy publiczne metody:
 *   - `summarizeChannel(input)`  — bullet summary ostatnich wiadomości sali
 *   - `explainText(input)`       — wyjaśnij prościej tekst wiadomości
 *   - `simplifyText(input)`      — streszczenie do 2 zdań
 *   - `translateText(input)`     — tłumaczenie na docelowy język (default EN)
 *
 * Wszystkie zwracają `AsyncGenerator<string>` z deltami markdown (przygotowane
 * pod `TypewriterMarkdown` / surowy `setState(prev => prev + delta)`).
 *
 * Auth: forward Bearer JWT z Supabase session (tak samo jak `BielikAdapter`).
 * Abort: caller dostaje opcjonalny `AbortSignal` → przekazujemy do `fetch`.
 */
import { supabase } from '../../supabaseClient'
import type {
  AulaAiPayload,
  ExplainOrSimplifyInput,
  SummarizeChannelInput,
  TranslateInput,
} from '../../lib/aulaAiPrompts'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const ENDPOINT = `${API_BASE}/api/aula-ai`

export class AulaAiServiceError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AulaAiServiceError'
    this.status = status
  }
}

type StreamOpts = {
  signal?: AbortSignal
}

async function postAulaAi(
  payload: AulaAiPayload,
  opts: StreamOpts,
): Promise<ReadableStream<Uint8Array>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  } catch {
    // ignoruj — brak auth header = anon rate-limit
  }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: opts.signal,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    throw new AulaAiServiceError(msg)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMsg = `Aula AI endpoint returned ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error && typeof parsed.error === 'string') {
        errorMsg = parsed.error
      }
    } catch {
      if (text) errorMsg = text.slice(0, 200)
    }
    throw new AulaAiServiceError(errorMsg, res.status)
  }

  if (!res.body) {
    throw new AulaAiServiceError('Empty response body', res.status)
  }

  return res.body
}

/**
 * Parser SSE — dekoduje `data: {...}\n\n` w formacie OpenAI delta i yielduje
 * same delty `content`. `[DONE]` zamyka. Buduje wewnętrzny linewise buffer,
 * bezpieczny na fragmentację chunków (chunk może zerwać linię w środku JSON-a).
 */
async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx = buffer.indexOf('\n\n')
      while (sepIdx !== -1) {
        const event = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)

        const delta = consumeEvent(event)
        if (delta === '__DONE__') return
        if (delta) yield delta

        sepIdx = buffer.indexOf('\n\n')
      }
    }

    const tail = buffer.trim()
    if (tail) {
      const delta = consumeEvent(tail)
      if (delta && delta !== '__DONE__') yield delta
    }
  } finally {
    reader.releaseLock()
  }
}

function consumeEvent(event: string): string {
  const lines = event.split('\n')
  let dataAcc = ''
  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trimStart()
    if (payload === '[DONE]') return '__DONE__'
    dataAcc += payload
  }
  if (!dataAcc) return ''
  try {
    const parsed = JSON.parse(dataAcc) as {
      choices?: Array<{ delta?: { content?: string | null } }>
    }
    const c = parsed?.choices?.[0]?.delta?.content
    return typeof c === 'string' ? c : ''
  } catch {
    return ''
  }
}

/**
 * Helper: convert AsyncGenerator into push-style callbacks. Wygodne dla UI
 * (`onChunk` per delta, `onError` w razie problemu). Zwraca cleanup funkcję
 * (no-op — abort odbywa się przez AbortController.signal).
 */
export async function consumeStream(
  gen: AsyncGenerator<string, void, void>,
  onChunk: (delta: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): Promise<void> {
  try {
    for await (const delta of gen) {
      onChunk(delta)
    }
    onDone?.()
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
  }
}

export const AulaAiService = {
  async *summarizeChannel(
    input: SummarizeChannelInput,
    opts: StreamOpts = {},
  ): AsyncGenerator<string, void, void> {
    const stream = await postAulaAi({ task: 'summarize_channel', input }, opts)
    yield* parseSseStream(stream)
  },

  async *explainText(
    input: ExplainOrSimplifyInput,
    opts: StreamOpts = {},
  ): AsyncGenerator<string, void, void> {
    const stream = await postAulaAi({ task: 'explain_message', input }, opts)
    yield* parseSseStream(stream)
  },

  async *simplifyText(
    input: ExplainOrSimplifyInput,
    opts: StreamOpts = {},
  ): AsyncGenerator<string, void, void> {
    const stream = await postAulaAi({ task: 'simplify_message', input }, opts)
    yield* parseSseStream(stream)
  },

  async *translateText(
    input: TranslateInput,
    opts: StreamOpts = {},
  ): AsyncGenerator<string, void, void> {
    const stream = await postAulaAi({ task: 'translate_message', input }, opts)
    yield* parseSseStream(stream)
  },
}
