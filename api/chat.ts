/**
 * Edge orchestrator dla AI chat z Function Calling (Tools).
 *
 * - **Runtime**: Vercel Edge (Web standards `Request` / `Response`).
 * - **Provider**: `GroqProvider` (OpenAI-compat) z modelem `llama-3.1-8b-instant`.
 *   `MockProvider` z `llmService.ts` jest świadomie pominięty w tool-aware
 *   ścieżce — bez `GROQ_API_KEY` brakuje sensu uruchamiać Function Calling.
 * - **Persona**: `UJVERSE_SYSTEM_PROMPT` z `_lib/llmService.ts` injectowany
 *   przez `withPersona(...)` jako pierwszy `system` message. Klient nie może
 *   podmienić tej instrukcji (`withPersona` filtruje zewnętrzne `system`-y).
 * - **Tool loop**: pętla rozwiązywania narzędzi (max `MAX_TOOL_ITERATIONS`
 *   iteracji). Pierwsza iteracja: wysyłamy historię + tools + tool_choice='auto'.
 *   Jeśli model zwróci `tool_calls[]` — wykonujemy każdy egzekutor, dokleja-
 *   my wynik jako wiadomość `role: 'tool'` z pasującym `tool_call_id`,
 *   pętla idzie dalej. Jeśli model zwróci `content` (bez `tool_calls`) —
 *   pętla się kończy.
 * - **Streaming UX**: po pętli syntezujemy POJEDYNCZY SSE chunk w formacie
 *   OpenAI delta, tak żeby klient (`BielikAdapter.parseSSEStream`) nie wymagał
 *   żadnych zmian. Pełny streaming finalnej odpowiedzi to opcja na później.
 * - **Auth**: `Authorization: Bearer <jwt>` jest opcjonalne. `extractRequestUser`
 *   weryfikuje JWT i zwraca `userId` (lub `null` dla anonimu). `userId`
 *   trafia do `ToolContext` — narzędzia mogą go logować i scope'ować.
 * - **Bezpieczeństwo**: tools wykonują zapytania przez `supabaseAdmin`
 *   (RLS bypass), ale udostępniają tylko tabele z publicznym `select`
 *   (announcements, events, posts). Klucz API i service role NIGDY nie
 *   trafiają do odpowiedzi.
 * - **CORS**: preflight `OPTIONS` + `Access-Control-*` na każdej odpowiedzi.
 */

import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'
import { extractRequestUser } from './_lib/auth.js'
import { withPersona } from './_lib/llmService.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { getToolEntry, toGroqToolsArray, type ToolContext } from './_lib/tools/index.js'
import { logTokenUsage, TokenUsageAccumulator } from './_lib/tokenUsage.js'
import type {
  ChatRole,
  GroqAssistantMessage,
  GroqMessage,
  GroqToolCall,
} from './_lib/types.js'

export const config = {
  runtime: 'edge',
}

const MAX_MESSAGES = 20
const MAX_CONTENT_CHARS = 4000
/**
 * Token Budgeting: twardy limit historii rozmowy wysyłanej do Groqa.
 * Gdy klient prześle > `MAX_HISTORY_MESSAGES` wiadomości, przycinamy do
 * ostatnich N (zachowujemy najnowsze tury — system prompt i tak jest
 * doklejany przez `withPersona`, więc nie liczy się do tego budżetu).
 * Cel: ograniczyć koszt tokenów na żądanie i ryzyko 429 z Groqa.
 */
const MAX_HISTORY_MESSAGES = 10
/**
 * Twardy limit pętli — chroni przed zapętleniem (model który ciągle wywołuje
 * narzędzia). Obniżone z 4 do 3 w ramach budżetu tokenów: każdy obrót pętli
 * to round-trip do Groqa + narzędzie. Trzy iteracje wystarczają na typowy
 * wzorzec (1× tool_call → 1× synteza → 1× rezerwa na poprawkę).
 */
const MAX_TOOL_ITERATIONS = 3
/** Komunikat zwracany użytkownikowi gdy Groq odpowie 429 (rate limit / quota). */
const RATE_LIMIT_USER_MESSAGE = 'System przeciążony (Rate Limit). Spróbuj za minutę.'
const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

type ProxyMessage = { role: string; content: string }

function isProxyMessage(value: unknown): value is ProxyMessage {
  if (!value || typeof value !== 'object') return false
  const r = (value as { role?: unknown }).role
  const c = (value as { content?: unknown }).content
  return typeof r === 'string' && typeof c === 'string'
}

function isMessagesPayload(value: unknown): value is { messages: ProxyMessage[] } {
  if (!value || typeof value !== 'object') return false
  const m = (value as { messages?: unknown }).messages
  if (!Array.isArray(m)) return false
  return m.every(isProxyMessage)
}

function isAllowedRole(role: string): role is ChatRole {
  return ALLOWED_ROLES.has(role as ChatRole)
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Tworzy strumień SSE z pojedynczym deltą + `[DONE]`. Klient parsuje to
 * tym samym kodem, którego używa do prawdziwego streamingu z Groqa.
 */
function synthesizeSSEStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    'data: [DONE]\n\n',
  ]
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

/**
 * Bezpieczne parsowanie `tool_call.function.arguments` (Groq wysyła JSON
 * jako string). Niepoprawny JSON → pusty obiekt + warning w logu; egzekutor
 * sam zdecyduje, czy to wystarczy do uruchomienia (np. `get_latest_*` nie
 * przyjmuje argumentów).
 */
function parseToolArgs(toolCall: GroqToolCall): Record<string, unknown> {
  const raw = toolCall.function.arguments
  if (!raw || raw.trim().length === 0) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch (err) {
    console.warn(
      '[AI Tool Call] failed to parse arguments JSON for',
      toolCall.function.name,
      'raw:',
      raw,
      'err:',
      err instanceof Error ? err.message : err,
    )
    return {}
  }
}

/**
 * Wykonuje pojedyncze `tool_call` z Groqa: parsuje JSON-argumenty, deleguje
 * do zarejestrowanego egzekutora (który JEST już zdekorowany cache'em w
 * `registry.ts`), zwraca surowy wynik gotowy do `JSON.stringify` w wiadomości
 * `role: 'tool'`.
 *
 * Defensive: try-catch wokół `entry.execute` — orchestrator NIGDY nie może
 * wywalić całego requestu z powodu błędu jednego narzędzia. W przypadku
 * wyjątku zwracamy strukturalny `{ ok: false, error }`, który model dostaje
 * jako wynik narzędzia i może o nim powiedzieć użytkownikowi.
 */
async function runToolCall(
  toolCall: GroqToolCall,
  ctx: ToolContext,
): Promise<unknown> {
  const name = toolCall.function.name
  const args = parseToolArgs(toolCall)

  console.log('[AI Tool Call] name:', name, 'args:', args, 'userId:', ctx.userId)

  const entry = getToolEntry(name)
  if (!entry) {
    return { ok: false, error: `Unknown tool: ${name}` }
  }

  try {
    return await entry.execute(args, ctx)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[AI Tool Call] executor threw for', name, '—', msg)
    return { ok: false, error: msg }
  }
}

export default async function handler(req: Request): Promise<Response> {
  console.log('Request received at /api/chat')
  console.log(
    'NODE_ENV:',
    process.env.NODE_ENV,
    '| GROQ key configured:',
    !!process.env.GROQ_API_KEY,
  )

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed')
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonError(415, 'Content-Type must be application/json')
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  if (!isMessagesPayload(raw)) {
    return jsonError(400, 'Body must be { messages: Array<{ role, content }> }')
  }

  const rawMessages = raw.messages
  if (rawMessages.length === 0) {
    return jsonError(400, 'messages must not be empty')
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return jsonError(413, `Too many messages (max ${MAX_MESSAGES})`)
  }

  const inboundMessages: GroqMessage[] = []
  for (const m of rawMessages) {
    if (!isAllowedRole(m.role)) {
      return jsonError(400, `Invalid role: ${m.role}`)
    }
    if (m.content.length > MAX_CONTENT_CHARS) {
      return jsonError(413, `Message content exceeds ${MAX_CONTENT_CHARS} chars`)
    }
    if (m.role === 'system') {
      inboundMessages.push({ role: 'system', content: m.content })
    } else if (m.role === 'user') {
      inboundMessages.push({ role: 'user', content: m.content })
    } else {
      inboundMessages.push({ role: 'assistant', content: m.content })
    }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('[api/chat] GROQ_API_KEY missing — tool-aware chat requires Groq')
    return jsonError(500, 'GROQ_API_KEY not configured')
  }

  let user: { userId: string | null }
  try {
    user = await extractRequestUser(req)
  } catch (err) {
    console.warn('[api/chat] extractRequestUser threw:', err instanceof Error ? err.message : err)
    user = { userId: null }
  }

  const provider = new GroqProvider(apiKey)
  const tools = toGroqToolsArray()

  const ctx: ToolContext = {
    userId: user.userId,
    supabaseAdmin: getSupabaseAdmin(),
  }

  // Token Budgeting: przytnij historię do ostatnich `MAX_HISTORY_MESSAGES`
  // wiadomości, zanim trafi do `withPersona` / `GroqProvider`. System prompt
  // jest dosztukowywany potem, więc tnie się czysta historia user/assistant.
  const trimmedHistory: GroqMessage[] =
    inboundMessages.length > MAX_HISTORY_MESSAGES
      ? inboundMessages.slice(-MAX_HISTORY_MESSAGES)
      : inboundMessages
  console.log(`[Token Check] History size: ${trimmedHistory.length}`)

  const conversation: GroqMessage[] = withPersona(trimmedHistory)

  let finalContent = ''
  /**
   * 429 z Groqa NIE jest błędem fatalnym dla użytkownika — to przejściowy
   * stan przeciążenia. Zamiast zwracać HTTP 429 (UI pokazałby toast "Asystent
   * nie odpowiada"), wsadzamy łagodny komunikat do strumienia SSE, dokładnie
   * tak jakby model sam to powiedział. Pętla się przerywa po pierwszym 429.
   */
  let assistantMessage: GroqAssistantMessage | null = null
  let rateLimited = false
  /**
   * Akumulator tokenów — sumuje `usage` z każdego round-tripu pętli.
   * Po pętli idzie fire-and-forget do `logTokenUsage` (zapis do
   * `api_usage_logs`), nie blokując strumienia SSE.
   */
  const usageAcc = new TokenUsageAccumulator()
  let resolvedModel = 'llama-3.1-8b-instant'

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      let completion: Awaited<ReturnType<GroqProvider['completeWithTools']>>
      try {
        completion = await provider.completeWithTools(conversation, tools)
      } catch (err) {
        if (err instanceof GroqProviderError && err.status === 429) {
          console.warn('[api/chat] Groq 429 (rate limit) — graceful degrade for user')
          rateLimited = true
          break
        }
        throw err
      }

      assistantMessage = completion.message
      usageAcc.add(completion.usage)
      resolvedModel = completion.model

      const toolCalls = assistantMessage.tool_calls ?? []

      if (toolCalls.length === 0) {
        finalContent = assistantMessage.content ?? ''
        break
      }

      conversation.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: toolCalls,
      })

      for (const call of toolCalls) {
        const result = await runToolCall(call, ctx)
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result),
        })
      }
    }

    if (rateLimited) {
      finalContent = RATE_LIMIT_USER_MESSAGE
    } else if (!finalContent) {
      console.warn(
        '[api/chat] tool loop exhausted without final content — falling back to last assistant.content',
      )
      finalContent =
        assistantMessage?.content ??
        'Przepraszam, nie udało mi się dokończyć odpowiedzi. Spróbuj ponownie.'
    }
  } catch (err) {
    if (err instanceof GroqProviderError) {
      console.error('LLM provider HTTP error:', err.status, err.message)
      return jsonError(err.status ?? 502, err.message)
    }
    console.error('LLM provider transport error:', err)
    return new Response('Proxy Error', {
      status: 502,
      headers: { ...CORS_HEADERS },
    })
  }

  // Fire-and-forget: zapis do `api_usage_logs` poza krytyczną ścieżką.
  // Świadomie BEZ `await` — błąd zapisu logów nie może opóźnić ani uszkodzić
  // odpowiedzi SSE dla użytkownika. `void` żeby ESLint nie marudził o
  // niezahandlowany promise.
  if (!usageAcc.isEmpty()) {
    void logTokenUsage({
      userId: ctx.userId,
      inputTokens: usageAcc.inputTokens,
      outputTokens: usageAcc.outputTokens,
      model: resolvedModel,
    })
  }

  const stream = synthesizeSSEStream(finalContent)
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    },
  })
}
