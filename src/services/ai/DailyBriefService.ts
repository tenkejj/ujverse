/**
 * UJverse — DailyBriefService: klient `/api/daily-brief` (streaming SSE).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Jeden public method `generateBrief(input)` zwraca `AsyncGenerator<string>`
 * z deltami markdown. Pattern 1:1 ze `AulaAiService` — w razie zmian w SSE
 * formacie aktualizujemy oba endpointy synchronicznie.
 *
 * Świadomie NIE share'ujemy parsera SSE między dwoma serwisami — koszt
 * duplikacji ~40 LOC vs zysk niezależności (zmiana w jednym AI scope nie
 * przewraca drugiego). Tooling-friendly.
 */
import { supabase } from '../../supabaseClient'
import type { DailyBriefInput } from '../../lib/dailyBriefPrompts'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const ENDPOINT = `${API_BASE}/api/daily-brief`

export class DailyBriefServiceError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'DailyBriefServiceError'
    this.status = status
  }
}

type StreamOpts = {
  signal?: AbortSignal
}

async function postDailyBrief(
  payload: DailyBriefInput,
  opts: StreamOpts,
): Promise<ReadableStream<Uint8Array>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  } catch {
    // ignoruj — brak auth header = anon rate-limit per IP
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
    throw new DailyBriefServiceError(msg)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMsg = `Daily brief endpoint returned ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error && typeof parsed.error === 'string') {
        errorMsg = parsed.error
      }
    } catch {
      if (text) errorMsg = text.slice(0, 200)
    }
    throw new DailyBriefServiceError(errorMsg, res.status)
  }

  if (!res.body) {
    throw new DailyBriefServiceError('Empty response body', res.status)
  }

  return res.body
}

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

export class DailyBriefService {
  /**
   * Generuje streaming brief dla zadanego user-day snapshot.
   * Yielduje delty markdown — kompatybilne z `TypewriterMarkdown`.
   */
  static async *generateBrief(
    input: DailyBriefInput,
    opts: StreamOpts = {},
  ): AsyncGenerator<string, void, void> {
    const stream = await postDailyBrief(input, opts)
    for await (const delta of parseSseStream(stream)) {
      yield delta
    }
  }
}
