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
 * - **Two-step tool flow**: wysyłamy historię + tools + tool_choice='auto'.
 *   Dwa wyniki możliwe:
 *   (a) model zwraca `content` (bez `tool_calls`) → finalna odpowiedź,
 *   (b) model zwraca `tool_calls[]` → wykonujemy każdy egzekutor, ekstrahujemy
 *       FAKTY (`buildToolFacts`), a finalną odpowiedź układa **mały, tani
 *       Llama 8B** (`synthesizeAnswer` w `_lib/synthesizer.ts`) — to daje
 *       naturalną prozę zamiast templatowych „X rzeczy: ..." odpowiedzi.
 *       Cost: +1 round-trip do Groqa (Llama 8B, ~150ms TTFB, ~$0.0001/req).
 *       Świadomy tradeoff dla UX nad surowym kosztem.
 * - **Response cache (Vercel KV)**: 300s rozproszony cache zindeksowany po
 *   treści ostatniej wiadomości użytkownika + flagdze `useTools`. HIT →
 *   strumień SSE bez wywołania Groqa **i** bez wywołania Supabase. Persistent
 *   między cold-startami i instancjami Edge — w przeciwieństwie do
 *   poprzedniego in-memory `TTLMemoryCache`, który zerował się przy każdym
 *   wybudzeniu funkcji. Per-tool cache w `registry.ts` dalej żyje równolegle
 *   (też migrowany na KV) i obsługuje dedup `tool_call` ze świeższymi TTL.
 * - **Markdown Guard**: ostatnia bramka przed wysłaniem do usera — wykrywa
 *   wyciek surowego JSON-a / schematu tool-call w finalContent i zamienia go
 *   na bezpieczny komunikat błędu. Patrz `_lib/utils/markdownGuard.ts`.
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

import { buildToolCacheKey } from './_lib/cache.js'
import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'
import { extractRequestUser } from './_lib/auth.js'
import { getActionLabel } from './_lib/actionLabels.js'
import { getFollowUpChips } from './_lib/followUpChips.js'
import { tryFastPath } from './_lib/fastPath.js'
import { buildAutoContext } from './_lib/autoContext.js'
import { detectTroll } from './_lib/trollHandler.js'
import { detectInjection } from './_lib/injectionGuard.js'
import { redactAndSlice } from './_lib/piiRedact.js'
import {
  gate as cbGate,
  recordError as cbRecordError,
  recordSuccess as cbRecordSuccess,
} from './_lib/groqCircuitBreaker.js'
import { routeIntent } from './_lib/intentRouter.js'
import { incrCounter, pushLatency } from './_lib/metrics.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
} from './_lib/ipRateLimit.js'
import { kvGetSafe, kvSetSafe } from './_lib/kvCache.js'
import {
  DEFAULT_GROQ_MODEL,
  GROQ_SMALLTALK_MODEL,
  withGroqRetry,
  withPersona,
} from './_lib/llmService.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import {
  buildToolFacts,
  streamAnswer,
  synthesizeAnswer,
  type ToolFactsResult,
} from './_lib/synthesizer.js'
import { generateSmartChips } from './_lib/smartChips.js'
import { updateUserMemory } from './_lib/userMemory.js'
import { getToolEntry, toGroqToolsArray, type ToolContext } from './_lib/tools/index.js'
import { logTokenUsage, TokenUsageAccumulator } from './_lib/tokenUsage.js'
import {
  MARKDOWN_GUARD_ERROR,
  validateMarkdown,
} from './_lib/utils/markdownGuard.js'
import type {
  ChatRole,
  GroqMessage,
  GroqToolCall,
} from './_lib/types.js'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
}

const MAX_MESSAGES = 20
const MAX_CONTENT_CHARS = 2500
/**
 * Token Budgeting: twardy limit historii rozmowy wysyłanej do Groqa.
 * Gdy klient prześle > `MAX_HISTORY_MESSAGES` wiadomości, przycinamy do
 * ostatnich N (zachowujemy najnowsze tury — system prompt i tak jest
 * doklejany przez `withPersona`, więc nie liczy się do tego budżetu).
 * Cel: ograniczyć koszt tokenów na żądanie i ryzyko 429 z Groqa.
 */
const MAX_HISTORY_MESSAGES = 8
/** Komunikat zwracany użytkownikowi gdy Groq odpowie 429 (rate limit / quota). */
const RATE_LIMIT_USER_MESSAGE = 'System przeciążony (Rate Limit). Spróbuj za minutę.'
/**
 * Komunikat dla circuit-breaker'a — gdy ostatnie N requestów się posypało,
 * przyznajemy się otwarcie (lepsze niż timeout). Dynamiczny `retryAfterSec`
 * dolatuje w runtime, dlatego template z placeholderem.
 */
const CIRCUIT_OPEN_MESSAGE_TEMPLATE = (retryAfterSec: number): string =>
  `Asystent musi złapać oddech (${Math.max(1, retryAfterSec)}s). Spróbuj za chwilę.`
const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

/**
 * Response cache TTL (sekundy) — finalna odpowiedź dla danej pary
 * (lastUserText, useTools) jest cache'owana w Vercel KV (Upstash Redis).
 *
 * Świadoma decyzja produktowa: trzymamy tylko **60s** (zamiast typowych
 * 300s), żeby asystent NIE odpowiadał z cache zbyt często — chcemy aby
 * Groq był faktycznie używany, a userzy widzieli świeże/zmieniające się
 * odpowiedzi. Z synthesizerem (Llama 8B) generującym wariancje per request,
 * 15s to bufor TYLKO anty-spam (gdy ten sam user wciśnie quick prompt 2× w
 * krótkim czasie). Po wygaśnięciu cache, kolejny user dostaje świeżą,
 * inaczej napisaną odpowiedź — to świadomy wybór, persona ma brzmieć
 * jak człowiek, nie jak nagrana sekretarka.
 *
 * Per-tool cache (TTL_FOR_TOOL w `registry.ts`) zostaje — to jest cache
 * danych ze Supabase, nie odpowiedzi LLM, i ten OK zostać agresywny
 * (60-300s zależnie od narzędzia). Synteza dalej dostanie te same fakty,
 * ale model je inaczej ułoży.
 *
 * Fast-path też pisze do response-cache (też przez tę stałą), więc po 15s
 * nawet `/dzis` znów wykona narzędzie + syntezę — koszt minimalny (1×
 * Llama 8B = ~$0.0001), a UX znacznie naturalniejszy.
 */
const RESPONSE_CACHE_TTL_SECONDS = 15

/**
 * Strip Qwen3 / DeepSeek-R1 style chain-of-thought ze stringa.
 *
 * Modele reasoning emitują wewnętrzne rozumowanie owinięte w
 * `<think>...</think>` PRZED finalną odpowiedzią (tzw. "thought leak").
 * Primary fix idzie przez `reasoning_format: 'hidden'` w `GroqProvider`
 * — Groq strip-uje to po swojej stronie. Ta funkcja to defensive last
 * line: pokrywa scenariusze gdy:
 *   - flaga `reasoning_format` nie jest honorowana dla danego modelu,
 *   - przyszły provider OpenAI-compat ignoruje ten parametr,
 *   - model emituje `<think>` mid-stream bez zamknięcia (cut connection).
 *
 * Strategia: usuwamy KAŻDY domknięty blok `<think>...</think>`
 * (non-greedy, multi-block), a następnie tnijemy orphan opening
 * `<think>` (i wszystko za nim) — bo brak zamknięcia oznacza, że
 * model nie zaczął jeszcze właściwej odpowiedzi.
 */
export function stripThinkingTags(text: string): string {
  if (!text) return text
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/<think>[\s\S]*$/i, '')
  return cleaned.trim()
}

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
 * Tworzy strumień SSE z pojedynczym deltą + `[DONE]`. Najszybsza ścieżka,
 * używana dla cache hits gdy klient i tak ma typewriter do animowania.
 *
 * Dla fast-path / rate-limit komunikatów wolimy `synthesizeChunkedSSEStream`
 * (poniżej) — fragmentuje treść, dzięki czemu serwer nie wysyła „bęc
 * całość", a klient widzi delty napływające w tempie zbliżonym do
 * prawdziwego streamingu z LLM.
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
 * Fragmentowany strumień SSE — wycina `content` na chunki ~80 znaków
 * (mniej więcej linia tekstu) i wysyła je co `CHUNK_DELAY_MS` (~50ms).
 * Klient widzi sekwencję delt, zupełnie jak ze streaming-aware Groqa.
 *
 * Po co: typewriter na kliencie i tak animuje znak-po-znaku, ale gdy
 * serwer wypluwa całość w jednym chunku, animacja STARTUJE od pełnego
 * `content.length` z `isStreaming=true→false` zaraz potem. Fragmentacja
 * pozwala typewriter'owi „dogonić" w tempie naturalnym, bez uderzeń
 * `catch-up`-u (długie odpowiedzi się nie zacinają na adaptive backlog).
 *
 * Wartości dobrane tak:
 *  - 80 znaków/chunk = ~1 zdanie / linia
 *  - 50 ms/chunk = ~1600 cps strumienia (klient nie nadąży tylko gdy
 *    typewriter ma <60 cps; wtedy klient buforuje, ale UX jest „streaming")
 */
function synthesizeChunkedSSEStream(
  content: string,
  meta?: { tool: string; label: string; chips?: readonly string[] } | null,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const CHUNK_SIZE = 80
  const CHUNK_DELAY_MS = 50

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Opcjonalny meta-event PRZED contentem — klient pokaże etykietę
        // typu „Sprawdzam zniżki…" zamiast generycznych „Myślę…".
        if (meta) {
          const metaPayload = JSON.stringify({ meta })
          controller.enqueue(encoder.encode(`data: ${metaPayload}\n\n`))
        }
        for (let i = 0; i < content.length; i += CHUNK_SIZE) {
          const slice = content.slice(i, i + CHUNK_SIZE)
          const payload = JSON.stringify({
            choices: [{ delta: { content: slice } }],
          })
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
          if (i + CHUNK_SIZE < content.length) {
            await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Maks rozmiar (znaki) starej wiadomości assistant trzymanej w historii.
 * Krzywa kosztów tokenów rośnie liniowo z ilością tekstu — typowa odpowiedź
 * narzędzia to 400-1200 znaków. Po N turach historia robi się tłusta
 * (~3-4k znaków = ~1k tokenów). Dla starszych odpowiedzi (NIE tej tuż przed
 * nowym pytaniem) trzymamy tylko `STALE_ASSISTANT_KEEP` znaków + `…`.
 *
 * Najnowsza assistant message ZAWSZE leci pełna — to ona jest kontekstem
 * dla follow-upu typu "powiedz więcej o tym", "a co z piątkiem".
 */
const STALE_ASSISTANT_KEEP = 240

/**
 * Token Budgeting helper:
 *   1. Przycina historię konwersacji do ostatnich `MAX_HISTORY_MESSAGES`.
 *   2. Kompresuje stare assistant messages (każdą poza najświeższą) do
 *      `STALE_ASSISTANT_KEEP` znaków.
 *
 * System prompt nie liczy się do tego budżetu — `withPersona` dokleja
 * personę po przycięciu, więc tnie się czysta historia user/assistant.
 */
export function pruneHistory(messages: GroqMessage[]): GroqMessage[] {
  const trimmed =
    messages.length <= MAX_HISTORY_MESSAGES
      ? messages
      : messages.slice(-MAX_HISTORY_MESSAGES)

  // Index ostatniej assistant message — tylko ona leci pełna.
  let lastAssistantIdx = -1
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (trimmed[i].role === 'assistant') {
      lastAssistantIdx = i
      break
    }
  }

  return trimmed.map((m, i) => {
    if (m.role !== 'assistant') return m
    if (i === lastAssistantIdx) return m
    if (m.content.length <= STALE_ASSISTANT_KEEP) return m
    return {
      ...m,
      content: `${m.content.slice(0, STALE_ASSISTANT_KEEP - 1)}…`,
    }
  })
}

/**
 * Small-talk detector — wzorce intencji NIE wymagających danych z bazy.
 *
 * Cel: ograniczyć liczbę wywołań Groqa (i ekspozycję na 429), gdy użytkownik
 * pisze "cześć" / "dzięki" / "ok". W takich przypadkach:
 * - nie wysyłamy schematów `tools` do modelu (oszczędność tokenów na wejściu),
 * - model nie odpala `tool_calls` (brak round-tripów Supabase + brak kolejnej
 *   iteracji pętli = jeden request do Groqa zamiast dwóch).
 *
 * Heurystyka jest CELOWO konserwatywna — matchujemy tylko czyste przywitania
 * i krótkie potwierdzenia. Dłuższe wypowiedzi (nawet zaczynające się od
 * „cześć, kiedy juwenalia?") nie pasują do wzorca i lecą zwykłą ścieżką
 * z `tools=auto`. Lepsze fałszywe pozytywy (czasem niepotrzebnie odpalimy
 * tools) niż fałszywe negatywy (model nie ma dostępu do bazy gdy powinien).
 */
const SMALLTALK_PATTERNS: readonly RegExp[] = [
  /^cześć[\s!.?,]*$/i,
  /^cześć wam[\s!.?,]*$/i,
  /^hej[\s!.?,]*$/i,
  /^siema[\s!.?,]*$/i,
  /^witaj[\s!.?,]*$/i,
  /^witam[\s!.?,]*$/i,
  /^dzień dobry[\s!.?,]*$/i,
  /^dobry wieczór[\s!.?,]*$/i,
  /^dobranoc[\s!.?,]*$/i,
  /^hi[\s!.?,]*$/i,
  /^hello[\s!.?,]*$/i,
  /^hey[\s!.?,]*$/i,
  /^yo[\s!.?,]*$/i,
  /^elo[\s!.?,]*$/i,
  /^halo[\s!.?,]*$/i,
  /^dzięki[\s!.?,]*$/i,
  /^dziękuję[\s!.?,]*$/i,
  /^dziekuje[\s!.?,]*$/i,
  /^thanks[\s!.?,]*$/i,
  /^thank you[\s!.?,]*$/i,
  /^ok[\s!.?,]*$/i,
  /^okej[\s!.?,]*$/i,
  /^okay[\s!.?,]*$/i,
  /^tak[\s!.?,]*$/i,
  /^nie[\s!.?,]*$/i,
  /^spoko[\s!.?,]*$/i,
  /^test[\s!.?,]*$/i,
  /^pa[\s!.?,]*$/i,
  /^pa pa[\s!.?,]*$/i,
] as const

/**
 * Maks długość treści użytkownika, dla której uruchamiamy detektor small-talku.
 * Powyżej tego progu zakładamy że jest jakieś merytoryczne pytanie i narzędzia
 * MOGĄ być potrzebne — kierujemy do default tool-aware path.
 */
const SMALLTALK_MAX_LENGTH = 24

/** Zwraca treść ostatniej wiadomości `role: 'user'` z historii (lub `''`). */
function lastUserMessageContent(messages: GroqMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') return m.content
  }
  return ''
}

/**
 * Wyciąga 1-3 ostatnich openerów assistant message'y — pierwsze 32 znaki
 * każdej, trimowane do końca słowa. Używane przez anti-repetition guard
 * w syntezatorze („NIE zaczynaj od ...").
 *
 * Dlaczego 32: krótko żeby model dostał sygnał wzorca, długo żeby uniknąć
 * matchowania w trafnych krótkich frazach typu „Spoko" (sama w sobie OK,
 * ale „Spoko, sprawdziłem..." × 3 turę pod rząd już nie).
 */
function recentAssistantOpeners(
  messages: GroqMessage[],
  count: number = 3,
): string[] {
  const openers: string[] = []
  for (let i = messages.length - 1; i >= 0 && openers.length < count; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    const trimmed = (m.content ?? '').trim()
    if (trimmed.length === 0) continue
    const opener = trimmed.slice(0, 32).split(/\s+/).slice(0, 4).join(' ')
    if (opener.length === 0) continue
    openers.push(opener)
  }
  return openers
}

/**
 * Decyzja "czy wpuszczać tools" dla bieżącego requestu. Zwraca `false` dla
 * czystych przywitań / podziękowań / krótkich potwierdzeń — w tej ścieżce do
 * Groqa idziemy BEZ `tools` (mniej tokenów na wejściu, brak ryzyka że model
 * zawoła Supabase dla "cześć", oszczędność jednego round-tripu pętli).
 */
export function shouldUseTools(userMessage: string): boolean {
  const trimmed = userMessage.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > SMALLTALK_MAX_LENGTH) return true
  for (const pattern of SMALLTALK_PATTERNS) {
    if (pattern.test(trimmed)) return false
  }
  return true
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

/**
 * Klucz response-cache'u dla pary (treść ostatniej wiadomości userskiej,
 * polityka tools). Normalizujemy: trim + lowercase + zwęź whitespace —
 * "Kiedy juwenalia?" i "kiedy   juwenalia?" trafiają w ten sam wpis,
 * zwiększając hit-rate. NIE bierzemy `userId` do klucza — odpowiedzi
 * narzędzi są publiczne (events/announcements/posts mają public RLS),
 * więc cache między userami jest bezpieczny i zwiększa pożyteczność.
 */
function buildResponseCacheKey(
  lastUserText: string,
  useTools: boolean,
): string {
  const normalized = lastUserText.trim().toLowerCase().replace(/\s+/g, ' ')
  return buildToolCacheKey('chat_response', {
    text: normalized,
    useTools,
  })
}

/**
 * Strumień SSE z gotową finalną odpowiedzią + nagłówki standardowe dla naszej
 * konwencji `text/event-stream`. Wydzielone z handlera, żeby ścieżka
 * "cache hit → response" miała ten sam shape co ścieżka "Groq → response".
 */
function streamFinalContent(finalContent: string): Response {
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

/**
 * Wariant `streamFinalContent` z chunkowanym strumieniem — używaj dla
 * fast-path, gdy chcesz żeby klient widział napływające delty zamiast
 * dostać całą odpowiedź w 1 chunku. Dla cache-hit'ów zostawiamy
 * non-chunked wariant — tam zwykle wystarczy szybkość przed
 * pobieraniem przez typewriter.
 */
function streamFinalContentChunked(
  finalContent: string,
  meta?: { tool: string; label: string; chips?: readonly string[] } | null,
): Response {
  const stream = synthesizeChunkedSSEStream(finalContent, meta)
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

/**
 * SSE response z LIVE streamem deltas Llama 8B (`streamAnswer` z synthesizer).
 *
 * Różnica vs `streamFinalContentChunked`:
 *  - Tam: serwer generuje całość → tnie po 80 znaków → emituje co 50ms.
 *    TTFB usera ≈ 1500ms (czeka aż Llama 8B napisze cały tekst).
 *  - Tu: live pipe-through z Groqa, delty napływają natychmiast.
 *    TTFB usera ≈ 200-400ms (pierwszy token Groqa).
 *
 * Markdown Guard: sprawdzany na BUFORZE po skończonym streamie. Jeśli model
 * leakuje JSON tool-call, klient zdążył już zobaczyć kilka znaków — to
 * świadomy tradeoff, leak <1% requestów, vs TTFB -1s dla 100% requestów.
 *
 * Cache + token usage: callback `onComplete(fullText, usage)` po `done`.
 * Tam wpisujemy do KV cache i logujemy.
 *
 * Fallback: jeśli streamCompletion rzuci (429, 5xx, transport) PRZED
 * pierwszą deltą → zwracamy chunked-fallback z synchronicznego
 * `synthesizeAnswer`. Po pierwszej delcie już za późno na fallback —
 * emitujemy error message do strumienia i zamykamy.
 */
function streamSynthesizedAnswer(opts: {
  provider: GroqProvider
  toolName: string | null
  result: unknown
  userQuery: string
  recentOpeners: readonly string[]
  usageAcc: TokenUsageAccumulator
  meta: { tool: string; label: string; chips?: readonly string[] } | null
  onComplete: (fullText: string) => void | Promise<void>
}): Response {
  const {
    provider,
    toolName,
    result,
    userQuery,
    recentOpeners,
    usageAcc,
    meta,
    onComplete,
  } = opts
  const facts = toolName ? buildToolFacts(toolName, result) : null

  // 'direct' kind (empty/error/passthrough) — bez Llamy 8B. Idziemy starym
  // chunked path: serwer już zna pełen text, więc fragmentacja po 80ch
  // daje OK feedback bez kosztu LLM round-tripa.
  if (facts && facts.kind === 'direct') {
    void onComplete(facts.text)
    return streamFinalContentChunked(facts.text, meta)
  }

  // 'synthesize' kind albo brak factsa (passthrough surowego string) —
  // live stream z Llamy 8B.
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Bufor pełnej odpowiedzi — do markdown guard + KV cache po `done`.
      let buffered = ''
      let emittedAnything = false

      try {
        if (meta) {
          const metaPayload = JSON.stringify({ meta })
          controller.enqueue(encoder.encode(`data: ${metaPayload}\n\n`))
        }

        if (!facts) {
          // Brak factsa (np. passthrough briefing) — emitujemy `result`
          // jako single delta i kończymy. Nigdy nie powinno się zdarzyć
          // z aktualnym kontraktem, ale defensive.
          const fallback = typeof result === 'string' ? result : ''
          if (fallback) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: fallback } }],
                })}\n\n`,
              ),
            )
            buffered = fallback
          }
        } else if (facts.kind === 'synthesize') {
          // Explicit narrow — TS gubi narrowing przez `ReadableStream.start`
          // callback (zmienna `facts` captured ze scope'u może być teoretycznie
          // reassignowana przed iteracją). Powtórzony check zwęża typ lokalnie.
          for await (const chunk of streamAnswer({
            userQuery,
            facts: facts.facts,
            hint: facts.hint,
            topicHint: facts.topicHint,
            provider,
            recentOpeners,
          })) {
            if (chunk.type === 'delta') {
              // NIE strippujemy per-delta przez `stripThinkingTags` bo ta
              // funkcja kończy się `.trim()` — zjada WIODĄCE SPACJE z każdej
              // delty Groqa. Llama 8B (GROQ_SMALLTALK_MODEL używany przez
              // `streamAnswer`) emituje tokeny typu " w", " Galerii", " Pizza"
              // i .trim() zlepia wszystkie słowa razem („Pizza Hut w Galerii"
              // → „PizzaHutwGalerii"). Llama 8B i tak nie generuje `<think>`,
              // więc strip jest zbędny w streamie. Defensywne: cały bufor
              // przechodzi przez `stripThinkingTags` po `done` (jakby kiedyś
              // syntezator przeszedł na model z reasoning leak).
              const content = chunk.content
              if (!content) continue
              buffered += content
              emittedAnything = true
              const payload = JSON.stringify({
                choices: [{ delta: { content } }],
              })
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
            } else if (chunk.type === 'done') {
              if (chunk.usage) usageAcc.add(chunk.usage)
            } else if (chunk.type === 'error') {
              console.warn(
                '[streamSynthesizedAnswer] inline error from provider:',
                chunk.message,
              )
              // Jeśli już cokolwiek wyemitowaliśmy, nie cofamy. Zamykamy
              // strumień grzecznie i polegamy na cache miss przy kolejnej
              // próbie. Bez emitted — fallback dorzucamy w catch.
              if (!emittedAnything) throw new Error(chunk.message)
              break
            }
          }
        }

        // Defensywny strip `<think>` na CAŁYM buforze (per-delta jest
        // niemożliwe bez utraty wiodących spacji — patrz komentarz wyżej).
        // Llama 8B nie generuje `<think>`, więc to no-op w 99.9% — strip
        // jest na wypadek future-proof gdyby syntezator przeszedł na
        // qwen3-32b / r1 i wyciekła im surowa reasoning.
        const stripped = stripThinkingTags(buffered)
        if (stripped.length !== buffered.length) {
          console.warn(
            '[streamSynthesizedAnswer] post-stream <think> detected in buffer, len delta:',
            buffered.length - stripped.length,
          )
          buffered = stripped
        }

        // Markdown Guard: sprawdzamy buforze (tak jak w non-streaming path).
        // Jeśli wycieka tool-call JSON, w teorii za późno (już wysłaliśmy),
        // ale logujemy + NIE wpisujemy do cache. Klient widzi syf w tej
        // turze, kolejne pójdą zdrowe (cache miss, retry z fresh response).
        const guarded = validateMarkdown(buffered)
        if (guarded === MARKDOWN_GUARD_ERROR) {
          console.warn(
            '[streamSynthesizedAnswer] Markdown Guard would rewrite — too late, content already streamed. Len:',
            buffered.length,
            '| first 120 chars (PII-redacted):',
            JSON.stringify(redactAndSlice(buffered, 120)),
          )
          // Nie cache'ujemy złamanej odpowiedzi.
        } else if (buffered.length > 0) {
          void onComplete(buffered)
        }

        // Smart Chips — generujemy LLM-em na bazie pełnej odpowiedzi i
        // emitujemy DRUGI meta-event z aktualnymi chipami (nadpisuje
        // statyczne z pierwszego meta-eventu). Timeout 800ms — jak nie
        // zdąży, klient zostaje przy statycznych. Skip dla pustych
        // odpowiedzi i guarded-out content (nie ma o czym pisać chipów).
        if (
          buffered.length > 0 &&
          guarded !== MARKDOWN_GUARD_ERROR &&
          toolName
        ) {
          try {
            const smartResult = await generateSmartChips({
              userQuery,
              fullAnswer: buffered,
              toolName,
              provider,
              timeoutMs: 800,
            })
            if (smartResult && smartResult.chips.length > 0 && meta) {
              if (smartResult.usage) usageAcc.add(smartResult.usage)
              const updatedMeta = {
                ...meta,
                chips: smartResult.chips as readonly string[],
              }
              const metaPayload = JSON.stringify({ meta: updatedMeta })
              controller.enqueue(encoder.encode(`data: ${metaPayload}\n\n`))
              void incrCounter('smart_chips:hit')
            } else {
              void incrCounter('smart_chips:miss')
            }
          } catch (err) {
            console.warn(
              '[streamSynthesizedAnswer] smart chips generation threw:',
              err instanceof Error ? err.message : err,
            )
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error(
          '[streamSynthesizedAnswer] stream failed:',
          err instanceof Error ? err.message : err,
        )
        // Jeszcze nic nie poszło → wyślij fallback message jako delta.
        if (!emittedAnything) {
          const fallback =
            'Coś po drodze się wykrzaczyło — spróbuj jeszcze raz za chwilę.'
          const payload = JSON.stringify({
            choices: [{ delta: { content: fallback } }],
          })
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

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

// Helpery formattujące daty / picki z surowych tool results żyją teraz
// w `_lib/toolFormatHelpers.ts` (dzielone z `_lib/synthesizer.ts`). Enumy
// PL → `_lib/toolEnums.ts`. Tu zostaje tylko orchestracja chatu.








/**
 * Tworzy naturalną odpowiedź z wyniku narzędzia. Etap pipelinu:
 *
 *   1) `buildToolFacts(toolName, result)` ekstrahuje fakty z surowego
 *      wyniku (deterministycznie). Empty results / error / passthrough →
 *      gotowy string, bez wywołania LLM.
 *   2) Jeśli mamy fakty do przedstawienia (`kind === 'synthesize'`),
 *      wołamy Llama 8B (`synthesizeAnswer`) z faktami + pytaniem usera +
 *      stylową personą. LLM układa to po ludzku, krótko, naturalnie.
 *   3) Failure modes Groqa (network / 5xx / pusty content) → fallback
 *      do plain bullet list z faktów. Brzydkie, ale lepsze niż "" do usera.
 *
 * Wiemy że to dodaje +1 round-trip do Groqa per tool (~150ms TTFB, ~$0.0001).
 * Świadomy tradeoff: serwerowe templaty były szybsze ale brzmiały robotycznie
 * i nie pasowały do pytania ("Spoko, 2 rzeczy" przy „gdzie zjem pizzę"). LLM
 * widzi pytanie + fakty → pisze sensownie, w tym echo'uje temat ("Pizzy
 * taniej? Pizza Hut...").
 */
async function synthesizeFinalAnswer(
  toolName: string,
  result: unknown,
  userQuery: string,
  provider: GroqProvider,
  usageAcc: TokenUsageAccumulator,
  recentOpeners?: readonly string[],
): Promise<string> {
  const facts = buildToolFacts(toolName, result)
  if (facts.kind === 'direct') {
    // Empty / error / passthrough — bez wywołania LLM, gotowy tekst.
    return facts.text
  }
  // facts.kind === 'synthesize' — wołamy Llama 8B
  try {
    const synthesis = await synthesizeAnswer({
      userQuery,
      facts: facts.facts,
      hint: facts.hint,
      topicHint: facts.topicHint,
      provider,
      recentOpeners,
    })
    if (synthesis.usage) {
      usageAcc.add(synthesis.usage)
    }
    if (!synthesis.text) {
      console.warn('[synthesize] empty response — falling back to facts')
      return factsToFallback(facts)
    }
    return synthesis.text
  } catch (err) {
    console.warn(
      '[synthesize] failed, falling back to facts:',
      err instanceof Error ? err.message : err,
    )
    return factsToFallback(facts)
  }
}

/** Fallback gdy Llama 8B się sypnęła — brzydki ale czytelny dump faktów. */
function factsToFallback(
  facts: Extract<ToolFactsResult, { kind: 'synthesize' }>,
): string {
  const tail = facts.hint ? `\n\n${facts.hint}.` : ''
  return facts.facts + tail
}


/**
 * Łączy wyniki >1 narzędzi w jedną odpowiedź. Format: każda sekcja oddzielona
 * `\n\n---\n\n` (horyzontalny separator markdown). To rzadkie — model zwykle
 * wywołuje 1 narzędzie naraz — ale `tool_choice: 'auto'` formalnie pozwala
 * na N>1 i nie chcemy w tym wypadku gubić części danych.
 */
function joinToolSections(sections: string[]): string {
  const nonEmpty = sections.map((s) => s.trim()).filter((s) => s.length > 0)
  if (nonEmpty.length === 0) {
    return 'Coś poszło nie tak — spróbuj jeszcze raz.'
  }
  return nonEmpty.join('\n\n')
}

export default async function handler(req: Request): Promise<Response> {
  // Pełny end-to-end timer — używany do bucket'a `chat:total_ms` w metrics
  // (KV ring buffer 200 pomiarów). Jeden punkt zerowania per request, każda
  // ścieżka exitu (cache hit / fast-path / Groq) loguje latency tym samym.
  const requestStartedAt = Date.now()
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

  // Per-key rate limit (defense-in-depth): zatrzymujemy spam Enterem od
  // pojedynczego klienta, zanim w ogóle dotkniemy KV / Groqa. Klucz =
  // `user:<uuid>` dla zalogowanych (NAT-friendly) lub `ip:<addr>` dla
  // anonimów. Gdy limit przekroczony, zwracamy SYNTETYCZNY SSE z łagodną
  // wiadomością — nie HTTP 429 — żeby klient (`BielikAdapter`) nie pokazał
  // toastu „Asystent nie odpowiada" i UX wyglądał normalnie.
  const rateLimitKey = user.userId
    ? `user:${user.userId}`
    : `ip:${extractClientIp(req)}`
  const rateLimit = checkAndConsumeRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    const retrySec = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))
    console.warn(
      '[RateLimit] denied key:',
      rateLimitKey,
      '| retryAfterMs:',
      rateLimit.retryAfterMs,
    )
    return streamFinalContent(
      `Wolniej — pytasz szybciej niż zdążę odpowiedzieć. Spróbuj ponownie za ${retrySec}s.`,
    )
  }
  console.log(
    '[RateLimit] allowed key:',
    rateLimitKey,
    '| tokensRemaining:',
    rateLimit.tokensRemaining,
  )

  const provider = new GroqProvider(apiKey, DEFAULT_GROQ_MODEL)
  const tools = toGroqToolsArray()

  const ctx: ToolContext = {
    userId: user.userId,
    supabaseAdmin: getSupabaseAdmin(),
  }

  // Akumulator tokenów — sumuje `usage` ze wszystkich wywołań Groqa (zarówno
  // tool decision jak i synteza finalnej odpowiedzi). Hoistowany przed
  // fast-path, bo fast-path też woła Groq do syntezy (Llama 8B).
  const usageAcc = new TokenUsageAccumulator()

  // Token Budgeting: przytnij historię do ostatnich `MAX_HISTORY_MESSAGES`
  // wiadomości, zanim trafi do `withPersona` / `GroqProvider`. System prompt
  // jest dosztukowywany potem, więc tnie się czysta historia user/assistant.
  const pruned = pruneHistory(inboundMessages)
  const droppedCount = inboundMessages.length - pruned.length
  if (droppedCount > 0) {
    console.warn(
      '[Token Check] history pruned:',
      droppedCount,
      'message(s) dropped — keeping last',
      MAX_HISTORY_MESSAGES,
    )
  }
  console.log('[Token Check] History size:', pruned.length)
  // Twarda asercja na inwariant token-budgetu: post-prune NIGDY nie może
  // przekroczyć `MAX_HISTORY_MESSAGES`. Gdyby `pruneHistory` kiedyś zwróciło
  // dłuższą tablicę (np. po refaktorze), Groq dostawałby napompowaną historię
  // i kolejne 429. Lepiej wywrócić request niż cicho marnować tokeny.
  if (pruned.length > MAX_HISTORY_MESSAGES) {
    console.error(
      '[Token Check] INVARIANT VIOLATION: pruned.length =',
      pruned.length,
      '> MAX_HISTORY_MESSAGES =',
      MAX_HISTORY_MESSAGES,
    )
    return jsonError(500, 'Internal token-budget invariant violated')
  }

  // Auto-context: niewidoczny `system` message z datą/godziną/profilem usera.
  // Wstrzykiwany jako DRUGI system po personie (`UJVERSE_SYSTEM_PROMPT`)
  // — Groq łączy multiple `system`-y w spójną tożsamość, a my zyskujemy
  // sterowanie sytuacyjne („wieczór wtorku" → bot wie czego nie proponować).
  // Profil cache'owany 5 min w KV, więc DB hit max raz per usera per okno.
  const autoContext = await buildAutoContext(user.userId, ctx.supabaseAdmin)
  const personaConversation = withPersona(pruned)
  const conversation: GroqMessage[] = [
    personaConversation[0]!,
    { role: 'system', content: autoContext },
    ...personaConversation.slice(1),
  ]

  // Tool-call throttling + Intent Routing.
  //
  // Krok 1: czy użytkownik w ogóle WYMAGA narzędzi? Small-talk ("cześć",
  // "dzięki") leci BEZ tools[] (-1 round-trip do Groqa, -700 tok input).
  //
  // Krok 2: gdy tools są potrzebne, klasyfikujemy intencję po keywordach
  // i wysyłamy TYLKO podzbiór narzędzi (1-4) zamiast całych 13.
  // Typowy zysk: ~600 tokenów input per request. Fallback `null` = full
  // zestaw (rzadkie, gdy keyword nie matchuje — np. "powiedz mi coś").
  const lastUserText = lastUserMessageContent(inboundMessages)
  const useTools = shouldUseTools(lastUserText)
  // Anti-repetition: top 3 ostatnich openerów assistant. Przekazywane do
  // `synthesizeFinalAnswer` w fast-path i głównym flow.
  const recentOpeners = recentAssistantOpeners(inboundMessages, 3)
  let effectiveTools: typeof tools = []
  let routedIntent: string[] | 'all' | 'none' = 'none'
  if (useTools) {
    const subset = routeIntent(lastUserText)
    // Stabilna alfabetyczna kolejność dla prefix-stable promptu (Groq
    // implicit prompt cache premiuje identyczne prefiksy między requestami).
    if (subset === null) {
      effectiveTools = [...tools].sort((a, b) =>
        a.function.name.localeCompare(b.function.name),
      )
      routedIntent = 'all'
    } else {
      const allowed = new Set<string>(subset)
      effectiveTools = tools
        .filter((t) => allowed.has(t.function.name))
        .sort((a, b) => a.function.name.localeCompare(b.function.name))
      routedIntent = subset
    }
  }
  console.log(
    '[Tool Routing] last user (first 60ch, PII-redacted):',
    JSON.stringify(redactAndSlice(lastUserText, 60)),
    '| useTools:',
    useTools,
    '| intent:',
    routedIntent,
    '| toolsSent:',
    effectiveTools.length,
    '/',
    tools.length,
  )

  // Prompt-Injection Guard — pierwsza linia obrony PRZED Groqiem. Wykrywa
  // próby przejęcia persony („ignoruj poprzednie instrukcje", „od teraz
  // jesteś...", „DAN", „[INST]") i odpowiada neutralnym deflectionem
  // zachowując osobowość Versusia. Robione PRZED troll-handlerem, bo
  // injection-attack potrafi się nie nakładać z bluzgiem.
  const injectionMatch = detectInjection(lastUserText)
  if (injectionMatch.detected) {
    console.warn(
      '[Injection Guard] match — pattern:',
      JSON.stringify(injectionMatch.matched),
      '— SKIPPING Groq entirely',
    )
    void incrCounter('injection:caught')
    void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
    return streamFinalContent(injectionMatch.reply)
  }

  // Troll Handler — przed wszystkim co wymaga Groqa. „spierdalaj" / „kurwa"
  // / „debil" → losowy witty come-back z `trollHandler.ts`, zero LLM calls.
  // Wcześniej takie wiadomości szły przez tool-decision (waste tokenów),
  // po czym lądowały w 429 albo „Wolniej, pytasz szybciej…". Teraz: 5ms,
  // luźna odpowiedź, żaden pieniądz nie spalony.
  const trollMatch = detectTroll(lastUserText)
  if (trollMatch.detected) {
    console.log(
      '[Troll Handler] match — pattern:',
      JSON.stringify(trollMatch.matched),
      '— SKIPPING Groq entirely',
    )
    void incrCounter('troll:caught')
    void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
    return streamFinalContent(trollMatch.comeback)
  }

  // Response cache lookup (Vercel KV) — short-circuit Groqa I Supabase'a,
  // jeśli ten sam tekst poszedł przez nas <300s temu. Pozycjonowane PO
  // ustaleniu `useTools`, bo polityka tools jest częścią klucza (small-talk
  // i merytoryczne pytanie o identycznej treści to różne ścieżki).
  // `kvGetSafe` NIGDY nie rzuca — przy błędzie KV (brak konfiguracji,
  // 5xx Upstash, timeout) zwraca undefined i jedziemy zwykłą ścieżką do Groqa.
  const responseCacheKey = buildResponseCacheKey(lastUserText, useTools)
  const cachedReply = await kvGetSafe<string>(responseCacheKey)
  if (cachedReply) {
    // Self-healing: stare wpisy w KV (sprzed `stripThinkingTags`) mogą zawierać
    // `<think>`. Strip-ujemy też na READ — gwarancja, że user nigdy nie zobaczy
    // wycieku, nawet z 5-minutowego cache'u sprzed deploya.
    const cleanedCached = stripThinkingTags(cachedReply)
    console.log(
      '[Response Cache] HIT key:',
      responseCacheKey,
      '| len:',
      cleanedCached.length,
      '— skipping Groq AND Supabase',
    )
    void incrCounter('response_cache:hit')
    void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
    return streamFinalContent(cleanedCached)
  }
  console.log('[Response Cache] MISS key:', responseCacheKey)
  void incrCounter('response_cache:miss')

  // Fast-Path bypass: dla zapytań o WYSOKIEJ pewności (slash commands,
  // exact-match popularnych pytań) wołamy narzędzie BEZPOŚREDNIO, BEZ Groqa.
  // Zysk: ~1100 tok input + ~200 tok output + ~1500ms latency per query.
  // Per-tool cache w `runWithCache` dalej działa — args są deterministyczne.
  const fastMatch = tryFastPath(lastUserText)
  if (fastMatch) {
    console.log(
      '[Fast Path] match — reason:',
      fastMatch.reason,
      '| tool:',
      fastMatch.toolName,
      '— SKIPPING Groq entirely',
    )
    const entry = getToolEntry(fastMatch.toolName)
    if (entry) {
      try {
        const result = await entry.execute(fastMatch.args, ctx)
        // Live stream syntezy Llamy 8B — pierwsze tokeny ~200-400ms zamiast
        // ~1500ms TTFB. Bufor odpowiedzi po `done` -> KV cache + metrics.
        const fastPathLabel = getActionLabel(fastMatch.toolName)
        const fastPathChips = getFollowUpChips(fastMatch.toolName)
        void incrCounter('fast_path:hit')
        void incrCounter(`fast_path:tool:${fastMatch.toolName}`)
        void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
        void pushLatency('chat:fast_path_ms', Date.now() - requestStartedAt)
        return streamSynthesizedAnswer({
          provider,
          toolName: fastMatch.toolName,
          result,
          userQuery: lastUserText,
          recentOpeners,
          usageAcc,
          meta: fastPathLabel
            ? {
                tool: fastMatch.toolName,
                label: fastPathLabel,
                chips: fastPathChips,
              }
            : null,
          onComplete: async (fullText) => {
            await kvSetSafe(
              responseCacheKey,
              fullText,
              RESPONSE_CACHE_TTL_SECONDS,
            )
          },
        })
      } catch (err) {
        console.warn(
          '[Fast Path] tool execution threw — falling back to Groq path:',
          err instanceof Error ? err.message : err,
        )
        void incrCounter('fast_path:execute_error')
      }
    } else {
      console.warn(
        '[Fast Path] tool not found in registry:',
        fastMatch.toolName,
        '— falling back to Groq',
      )
      void incrCounter('fast_path:registry_miss')
    }
  } else {
    void incrCounter('fast_path:miss')
  }

  let finalContent = ''
  /**
   * 429 z Groqa NIE jest błędem fatalnym dla użytkownika — to przejściowy
   * stan przeciążenia. Zamiast zwracać HTTP 429 (UI pokazałby toast "Asystent
   * nie odpowiada"), wsadzamy łagodny komunikat do strumienia SSE, dokładnie
   * tak jakby model sam to powiedział.
   */
  let rateLimited = false
  /**
   * Najnowsza nazwa narzędzia, której orchestrator używa przy budowie
   * odpowiedzi. Wysyłamy ją jako meta event w SSE, żeby klient mógł pokazać
   * np. „Sprawdzam zniżki…" zamiast generycznego „Myślę…".
   * `null` = brak narzędzia (Groq odpowiedział sam) — klient użyje rotujących
   * thinking-phrases.
   */
  let executedToolName: string | null = null
  // `usageAcc` zadeklarowany powyżej (przed fast-path) — sumuje tokeny ze
  // wszystkich wywołań Groqa: tool decision (qwen3-32b) + synthesis (Llama 8B).
  let resolvedModel = DEFAULT_GROQ_MODEL

  try {
    type Completion = Awaited<ReturnType<GroqProvider['completeWithTools']>>
    let completion: Completion | null = null
    // Mały model dla ścieżki SMALL-TALK (brak tools, „cześć/dzięki/co u Ciebie").
    // qwen3-32b kosztowałby ~5× więcej i odpowiadał ~3× wolniej dla luźnej
    // pogawędki. Cap 400 tok — z nową luźną personą model dorzuca komentarze
    // / żarty / wyjaśnienia („balić auli to...") i wcześniejsze 200 ucinało
    // odpowiedzi w pół słowa. 400 tok = ~7-8 zdań PL, max comfort.
    const isSmallTalkPath = !useTools
    const completeOpts = isSmallTalkPath
      ? { model: GROQ_SMALLTALK_MODEL, maxTokens: 400 }
      : undefined
    if (isSmallTalkPath) {
      void incrCounter('groq:small_talk_path')
      console.log(
        '[Groq] small-talk path — model:',
        GROQ_SMALLTALK_MODEL,
        '| maxTokens: 400',
      )
    }
    // Circuit breaker — gdy ostatnie N requestów do Groqa padło 429/5xx,
    // odmawiamy NATYCHMIAST z friendly message zamiast czekać 3-5s na
    // timeout. Stan trzymany w KV (cross-instance), fail-open przy
    // niedostępnym KV. Patrz `groqCircuitBreaker.ts`.
    const cbDecision = await cbGate()
    if (cbDecision.allow === false) {
      // Explicit discriminator check (`=== false`) zamiast `!cbDecision.allow`
      // — bez tego Vercel TS checker gubi narrow do `{allow:false, ...}` i nie
      // widzi `retryAfterSec`. Standalone tsc narrowuje OK, więc to różnica
      // konfiguracji per-file checker'a Vercel.
      const retryAfterSec = cbDecision.retryAfterSec
      console.warn(
        '[Groq CB] OPEN — refusing request, retryAfter:',
        retryAfterSec,
        's',
      )
      void incrCounter('groq:cb:short_circuit')
      const message = CIRCUIT_OPEN_MESSAGE_TEMPLATE(retryAfterSec)
      void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
      return streamFinalContentChunked(message, null)
    }
    if (cbDecision.state === 'HALF_OPEN') {
      console.log('[Groq CB] HALF_OPEN — letting probe request through')
      void incrCounter('groq:cb:probe')
    }
    try {
      // Wrap w `withGroqRetry`: 3 próby z exponential backoff dla 429/5xx +
      // transport errors. Free tier Groqa ma niskie RPM (Llama 8B = 30/min),
      // więc szybki burst zapytań od jednego usera potrafi wpaść w 429.
      // Cichy retry (~500ms / ~1s / ~2s) zwykle ten window oczekuje.
      completion = await withGroqRetry(() =>
        provider.completeWithTools(conversation, effectiveTools, completeOpts),
      )
      // Sukces probe'a → CB wraca do CLOSED. Sukces zwykłego requestu też
      // czyści `open_until` (no-op gdy klucza i tak nie było). Tani write.
      void cbRecordSuccess()
    } catch (err) {
      if (err instanceof GroqProviderError && err.status === 429) {
        console.warn('[api/chat] Groq 429 (rate limit) — graceful degrade for user')
        rateLimited = true
        void cbRecordError({ status: 429, reason: 'rate_limit' })
      } else if (err instanceof GroqProviderError && err.status && err.status >= 500) {
        // 5xx z Groqa = problem po ich stronie, też karmimy CB
        void cbRecordError({ status: err.status, reason: 'server_error' })
        throw err
      } else {
        throw err
      }
    }

    if (completion) {
      usageAcc.add(completion.usage)
      resolvedModel = completion.model

      const assistantMessage = completion.message
      const toolCalls = assistantMessage.tool_calls ?? []

      if (toolCalls.length === 0) {
        // Ścieżka A: model sam wygenerował odpowiedź (np. small-talk, brak
        // sensownego narzędzia). Jego content idzie 1:1 do usera, po
        // defensywnym strip-ie `<think>` (drugie zabezpieczenie na wypadek
        // gdyby Groq nie uszanował `reasoning_format: 'hidden'`).
        const rawContent = assistantMessage.content ?? ''
        finalContent = stripThinkingTags(rawContent)
        if (finalContent.length !== rawContent.length) {
          console.warn(
            '[Thought Strip] removed <think> tags from model content. raw len:',
            rawContent.length,
            '| cleaned len:',
            finalContent.length,
          )
        }
        console.log(
          '[Tool Flow] no tool_calls — using model content directly | len:',
          finalContent.length,
        )
      } else if (toolCalls.length === 1) {
        // Ścieżka B1 (95% przypadków): pojedynczy tool_call → live stream
        // syntezy. Pierwsze tokeny u usera ~200-400ms zamiast ~1500ms TTFB.
        // Wykonujemy tool sync, potem oddajemy kontrolę do
        // `streamSynthesizedAnswer` który pipuje delty Llamy 8B do SSE i
        // bufforuje pełen content do KV cache.
        const firstCall = toolCalls[0]!
        const toolName = firstCall.function.name
        console.log(
          '[Tool Flow] single tool_call →',
          toolName,
          '— live stream synthesis (TTFB optimized)',
        )
        const result = await runToolCall(firstCall, ctx)
        executedToolName = toolName

        const finalLabel = getActionLabel(toolName)
        const finalChips = getFollowUpChips(toolName)
        void incrCounter('groq:served')
        void incrCounter(`groq:tool:${toolName}`)
        void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
        void pushLatency('chat:groq_path_ms', Date.now() - requestStartedAt)
        // `usageAcc` zawiera już tool-decision usage; streamSynth doda
        // synthesis usage przez akumulator. Logujemy fire-and-forget po
        // skończonym streamie (callback `onComplete`).
        return streamSynthesizedAnswer({
          provider,
          toolName,
          result,
          userQuery: lastUserText,
          recentOpeners,
          usageAcc,
          meta: finalLabel
            ? { tool: toolName, label: finalLabel, chips: finalChips }
            : null,
          onComplete: async (fullText) => {
            await kvSetSafe(
              responseCacheKey,
              fullText,
              RESPONSE_CACHE_TTL_SECONDS,
            )
            if (!usageAcc.isEmpty()) {
              void logTokenUsage({
                userId: ctx.userId,
                inputTokens: usageAcc.inputTokens,
                outputTokens: usageAcc.outputTokens,
                model: resolvedModel,
              })
            }
            // Memory update fire-and-forget — co N tur ekstrahujemy
            // preferencje usera (dieta, mieszkanie, hobby) do KV.
            // Throttled wewnatrz updateUserMemory (modulo 3 user messages),
            // wiec to nie kazdy request triggeruje LLM call.
            void updateUserMemory({
              userId: ctx.userId,
              conversation: [
                ...conversation,
                { role: 'assistant', content: fullText },
              ],
              provider,
            })
          },
        })
      } else {
        // Ścieżka B2: 2+ tool_calls (rzadkie, ~5%). Streaming dwóch sekcji
        // równolegle psuje UX (delty się przeplatają), więc zostajemy przy
        // non-streaming `synthesizeFinalAnswer` + `joinToolSections`.
        console.log(
          '[Tool Flow] got',
          toolCalls.length,
          'tool_call(s) — parallel synthesis (no live stream)',
        )
        const sections = await Promise.all(
          toolCalls.map(async (call) => {
            const result = await runToolCall(call, ctx)
            return synthesizeFinalAnswer(
              call.function.name,
              result,
              lastUserText,
              provider,
              usageAcc,
              recentOpeners,
            )
          }),
        )
        finalContent = joinToolSections(sections)
        const firstCall = toolCalls[0]
        if (firstCall?.function?.name) {
          executedToolName = firstCall.function.name
        }
      }
    }

    if (rateLimited) {
      finalContent = RATE_LIMIT_USER_MESSAGE
    } else if (!finalContent) {
      console.warn(
        '[api/chat] empty finalContent after single-shot path — using safe fallback',
      )
      finalContent = 'Przepraszam, nie udało mi się dokończyć odpowiedzi. Spróbuj ponownie.'
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

  // Markdown Guard — OSTATNIA bramka przed wysłaniem. Jeśli `finalContent`
  // wygląda na surowy JSON / wyciek schematu tool-call, podmieniamy na
  // bezpieczny komunikat błędu. Robimy to PRZED zapisem do cache'u, żeby
  // nigdy nie zapisać złamanej odpowiedzi (self-perpetuating problem).
  const guardedContent = validateMarkdown(finalContent)
  if (guardedContent === MARKDOWN_GUARD_ERROR) {
    console.warn(
      '[Markdown Guard] rewriting finalContent to error message. Original len:',
      finalContent.length,
      '| first 120 chars (PII-redacted):',
      JSON.stringify(redactAndSlice(finalContent, 120)),
    )
  }

  // Sukces — wsadź do response-cache'u (KV). Pomijamy:
  //  - 429 (komunikat o przeciążeniu jest tymczasowy, cache'owanie utrwaliłoby
  //    "system przeciążony" odpowiedź na 5 minut po tym, jak limit wraca);
  //  - puste odpowiedzi;
  //  - odpowiedzi zablokowane przez Markdown Guard (nie cache'ujemy błędu).
  // `kvSetSafe` jest fire-and-forget — błąd zapisu loguje warn, nie wywraca
  // request-u; mimo to `await`-ujemy, bo Edge function nie ma `waitUntil`
  // w darmowym planie i bez awaita Promise mógłby zostać porzucony.
  if (
    !rateLimited &&
    guardedContent.length > 0 &&
    guardedContent !== MARKDOWN_GUARD_ERROR
  ) {
    await kvSetSafe(responseCacheKey, guardedContent, RESPONSE_CACHE_TTL_SECONDS)
    console.log(
      '[Response Cache] SET key:',
      responseCacheKey,
      '| len:',
      guardedContent.length,
      '| ttlSec:',
      RESPONSE_CACHE_TTL_SECONDS,
    )
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

  // Chunkowany strumień — klient widzi napływające delty zamiast „bęc całość".
  // Spójność z fast-path'em (oba zwracają fragmentowane SSE), typewriter ma
  // naturalny feed. Dorzucamy meta event z `tool` + `label` (UI pokaże
  // „Sprawdzam zniżki…" zamiast losowych „Myślę…") + `chips` (klikalne
  // sugestie pod wiadomością — szybki next-step bez pisania).
  const finalLabel = executedToolName ? getActionLabel(executedToolName) : null
  const finalChips = executedToolName ? getFollowUpChips(executedToolName) : []
  void incrCounter('groq:served')
  if (executedToolName) {
    void incrCounter(`groq:tool:${executedToolName}`)
  }
  if (rateLimited) {
    void incrCounter('groq:rate_limited')
  }
  void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
  void pushLatency('chat:groq_path_ms', Date.now() - requestStartedAt)
  return streamFinalContentChunked(
    guardedContent,
    executedToolName && finalLabel
      ? { tool: executedToolName, label: finalLabel, chips: finalChips }
      : null,
  )
}
