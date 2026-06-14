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
 * - **Single-shot tool flow (no loop)**: wysyłamy historię + tools +
 *   tool_choice='auto' raz. Dwa wyniki możliwe:
 *   (a) model zwraca `content` (bez `tool_calls`) → to nasza finalna odpowiedź,
 *   (b) model zwraca `tool_calls[]` → wykonujemy każdy egzekutor i
 *       **formatujemy wyniki PO STRONIE SERWERA** (`formatToolResultAsFinalAnswer`)
 *       jako finalną odpowiedź dla użytkownika — **bez** drugiego round-tripu
 *       do Groqa na "podsumowanie". To wprost obcina liczbę zapytań do LLM
 *       o ~50% w typowej ścieżce z tools (była: 1× klasyfikacja + 1× synteza;
 *       jest: 1× klasyfikacja). Bezpośrednie cięcie ekspozycji na 429.
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
import { tryFastPath } from './_lib/fastPath.js'
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
  withPersona,
} from './_lib/llmService.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
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
 * odpowiedzi. 60s wystarcza tylko jako bufor anty-spam (gdy ten sam user
 * dwa razy wciśnie quick prompt w 5s) i defence przed kaskadą 429.
 *
 * Per-tool cache (TTL_FOR_TOOL w `registry.ts`) zostaje — to jest cache
 * danych ze Supabase, nie odpowiedzi LLM, i ten OK zostać agresywny
 * (60-300s zależnie od narzędzia).
 *
 * Fast-path też pisze do response-cache (też przez tę stałą), więc po 60s
 * nawet `/dzis` znów wykona narzędzie + format'er — dane są świeższe,
 * koszt minimalny (fast-path pomija Groqa i tak).
 */
const RESPONSE_CACHE_TTL_SECONDS = 60

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
  meta?: { tool: string; label: string } | null,
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
  meta?: { tool: string; label: string } | null,
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
 * Skraca tekst do `max` znaków, dodając `…`. Dla `body`/`description`
 * z bazy (nieograniczone w schemacie) — nie chcemy zalać użytkownika
 * stronami tekstu.
 */
function clip(text: string, max: number): string {
  const t = (text ?? '').toString()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

/**
 * Formatuje wartość ISO daty na krótki, czytelny format `YYYY-MM-DD HH:mm`
 * (lub samo `YYYY-MM-DD` gdy czas to 00:00). Świadomie BEZ
 * `Intl.DateTimeFormat('pl-PL', …)` — Vercel Edge bywa zbudowany bez pełnego
 * ICU i wtedy zwraca en-US zamiast polskich nazw miesięcy. Stabilny ISO-like
 * format jest brzydszy, ale przewidywalny w każdym środowisku.
 */
function formatDateShort(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return 'brak daty'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'brak daty'
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const HH = String(d.getUTCHours()).padStart(2, '0')
  const MM = String(d.getUTCMinutes()).padStart(2, '0')
  if (HH === '00' && MM === '00') return `${yyyy}-${mm}-${dd}`
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`
}

/**
 * Formatuje datę jako tekst RELATYWNY do "teraz" — w stylu chatu /
 * mediów społecznościowych ("3 godz. temu", "wczoraj", "2 dni temu").
 * Stosowany w formatterach narzędzi dla feedu/ogłoszeń, gdzie data
 * absolutna `2026-06-08 20:30` brzmi formalnie i zaśmieca odpowiedź.
 *
 * Granice:
 * - < 60s → „przed chwilą"
 * - < 60min → „N min temu"
 * - < 24h → „N godz. temu"
 * - < 48h → „wczoraj"
 * - < 7 dni → „N dni temu"
 * - >= 7 dni → `formatDateShort(iso)` (full ISO-like fallback)
 *
 * Świadomie BEZ `Intl.RelativeTimeFormat('pl', ...)` — Vercel Edge bywa
 * zbudowany bez pełnego ICU, więc polskie formy gramatyczne są niepewne.
 * Ręcznie dobrane formy "godz./dni" są dłuższe, ale stabilne na każdym runtime.
 */
function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return 'brak daty'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'brak daty'
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return formatDateShort(iso)
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'przed chwilą'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min temu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} godz. temu`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'wczoraj'
  if (day < 7) return `${day} dni temu`
  return formatDateShort(iso)
}

/**
 * Heurystyka „post jest spamem / pusty" — używana w `formatPostsResult`
 * żeby nie zaśmiecać odpowiedzi asystenta postami testowymi typu `#pomoc`,
 * `#ankiet`, pojedynczymi linkami bez kontekstu albo postami <20 znaków.
 *
 * Reguły:
 * - brak `body` / sama spacja → spam
 * - body < 20 znaków NIE-tagowych (po wycięciu hashtagów) → spam
 * - body to wyłącznie pojedynczy URL bez własnego tekstu → spam
 *
 * Świadomie NIE filtrujemy po słownikach wulgaryzmów / blacklist — to
 * jest zadanie moderacji, nie formattera odpowiedzi. Tu chodzi tylko
 * o jakość prezentacji w odpowiedzi asystenta.
 */
function isSpamPost(body: string, tags: string[]): boolean {
  const trimmed = (body ?? '').trim()
  if (trimmed.length === 0) return true
  const withoutTags = trimmed.replace(/#[\p{L}\p{N}_-]+/gu, '').trim()
  if (withoutTags.length < 20) {
    if (tags.length > 0 && withoutTags.length === 0) return true
    if (withoutTags.length === 0) return true
    if (withoutTags.length < 10) return true
  }
  const urlOnly = /^https?:\/\/\S+$/i.test(withoutTags)
  if (urlOnly) return true
  return false
}

/** Mapowanie `announcements.status` enum → polskie nazwy widoczne dla usera. */
const ANNOUNCEMENT_STATUS_PL: Record<string, string> = {
  cancelled: 'odwołane',
  remote: 'zdalnie',
  duty: 'dyżur',
}

/**
 * Type guard'y dla wyników tools. Świadomie luźne (`any`-by-shape), bo wynik
 * narzędzia w runtime przychodzi jako `unknown` z `runToolCall` — TS nie wie
 * który tool to wywołał, tylko że to coś co `JSON.stringify`-uje się.
 */
function isToolErrorObject(value: unknown): value is { ok: false; error?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in (value as Record<string, unknown>) &&
    (value as { ok?: unknown }).ok === false
  )
}

function getItemsArray(value: unknown): unknown[] | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'items' in (value as Record<string, unknown>)
  ) {
    const items = (value as { items?: unknown }).items
    if (Array.isArray(items)) return items
  }
  return null
}

function pickString(obj: unknown, key: string): string {
  if (typeof obj !== 'object' || obj === null) return ''
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : ''
}

function pickStringOrNull(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function pickBool(obj: unknown, key: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  return Boolean((obj as Record<string, unknown>)[key])
}

function pickStringArray(obj: unknown, key: string): string[] {
  if (typeof obj !== 'object' || obj === null) return []
  const v = (obj as Record<string, unknown>)[key]
  if (!Array.isArray(v)) return []
  return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
}

/**
 * Sufiks kontekstowy dla daty wydarzenia. W przeciwieństwie do
 * `formatRelativeDate` (które patrzy WSTECZ — „2 godz. temu"), tu
 * patrzymy W PRZÓD: „za 3 dni", „jutro", „dziś", „już minęło".
 *
 * Wynik to fragment do doklejenia w nawiasie obok absolutnej daty, np.:
 *   `2026-06-12 18:00 (jutro)`
 *   `2026-06-15 (za 7 dni)`
 *   `2025-12-04 (już minęło)`
 *
 * Bez sufiksu (pusty string) gdy data jest > 30 dni do przodu — wtedy
 * sama absolutna data jest wystarczająca i nie zaśmiecamy listy.
 */
function eventDateContext(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - Date.now()
  if (diffMs < -24 * 3600_000) return 'już minęło'
  if (diffMs < 0) return 'było dziś'
  const hr = Math.floor(diffMs / 3600_000)
  if (hr < 12) return 'dziś'
  const day = Math.floor(diffMs / (24 * 3600_000))
  if (day === 0) return 'dziś'
  if (day === 1) return 'jutro'
  if (day < 7) return `za ${day} dni`
  if (day < 14) return 'za tydzień'
  if (day < 30) return `za ${day} dni`
  return ''
}

const MAX_EVENTS_TO_SHOW = 5

/**
 * Style: konwersacyjna proza, bez bulletów. Każdy item to jedno krótkie
 * zdanie typu "X dziś o 18:00 w Audytorium Maximum" zlewane przecinkami.
 * Dla 4+ items rozdzielamy newlinem (czytelnie, ale bez `- ` markerów).
 */
function formatSearchEventsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Nic mi się nie znalazło. Spróbuj innego hasła albo zajrzyj na zakładkę Wydarzenia.'
  }
  const items = rawItems.slice(0, MAX_EVENTS_TO_SHOW)
  const remaining = rawItems.length - items.length

  const sentences = items.map((item) => {
    const title = pickString(item, 'title') || 'wydarzenie bez tytułu'
    const location = pickStringOrNull(item, 'location')
    const date = pickStringOrNull(item, 'date')
    const isOfficial = pickBool(item, 'is_official')

    const ctx = eventDateContext(date)
    const datePart = date
      ? ctx
        ? `${ctx} (${formatDateShort(date)})`
        : formatDateShort(date)
      : 'bez daty'
    const tag = isOfficial ? '' : ' (studenckie)'
    const where = location ? ` w ${location}` : ''
    return `**${title}**${tag} — ${datePart}${where}`
  })

  const lead =
    items.length === 1
      ? 'Znalazłem coś:'
      : `Mam dla Ciebie ${items.length}:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nW bazie jest jeszcze ${remaining} — zerknij na zakładkę Wydarzenia.`
      : ''
  return `${lead}\n${body}${tail}`
}

const MAX_ANNOUNCEMENTS_TO_SHOW = 5

function formatAnnouncementsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Cisza, ostatnio nic nowego z ISI UJ nie wpadło.'
  }
  const items = rawItems.slice(0, MAX_ANNOUNCEMENTS_TO_SHOW)
  const remaining = rawItems.length - items.length

  const departments = items
    .map((item) => pickStringOrNull(item, 'department'))
    .filter((d): d is string => !!d)
  const allSameDept =
    departments.length === items.length &&
    departments.length > 1 &&
    departments.every((d) => d === departments[0])
  const sharedDept = allSameDept ? departments[0] : null

  const sentences = items.map((item) => {
    const lecturer =
      pickString(item, 'lecturer_name_nominative') || 'ktoś z kadry'
    const statusKey = pickString(item, 'status')
    const statusPl = ANNOUNCEMENT_STATUS_PL[statusKey] ?? statusKey
    const body = pickString(item, 'body')
    const dept = pickStringOrNull(item, 'department')
    const createdAt = pickStringOrNull(item, 'created_at')

    const when = createdAt ? ` (${formatRelativeDate(createdAt)})` : ''
    const tail = body ? ` — ${clip(body, 160)}` : ''
    const deptTag = !sharedDept && dept ? ` [${dept}]` : ''
    return `**${lecturer}** ${statusPl}${when}${deptTag}${tail}`
  })

  const leadDept = sharedDept ? ` z ${sharedDept}` : ''
  const lead =
    items.length === 1
      ? `Najświeższy komunikat${leadDept}:`
      : `Najświeższe komunikaty${leadDept}:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nJest jeszcze ${remaining} — wejdź na pełną listę.`
      : ''
  return `${lead}\n${body}${tail}`
}

const MAX_POSTS_TO_SHOW = 4

function formatPostsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Cisza na feedzie — nikt nic ostatnio nie napisał.'
  }

  const filtered = rawItems.filter((item) => {
    const body = pickString(item, 'body')
    const tags = pickStringArray(item, 'tags')
    return !isSpamPost(body, tags)
  })
  if (filtered.length === 0) {
    return 'Coś tam jest, ale same krótkie wpisy, nic ciekawego do cytowania. Zerknij na zakładkę Feed.'
  }

  const items = filtered.slice(0, MAX_POSTS_TO_SHOW)
  const remaining = filtered.length - items.length

  const sentences = items.map((item) => {
    const author = (typeof item === 'object' && item !== null
      ? (item as Record<string, unknown>).author
      : null) as Record<string, unknown> | null
    const username =
      (author && typeof author.username === 'string' && author.username) ||
      'anon'
    const body = pickString(item, 'body')
    const createdAt = pickStringOrNull(item, 'created_at')
    const when = createdAt ? ` (${formatRelativeDate(createdAt)})` : ''
    const quote = body ? ` „${clip(body, 140)}"` : ''
    return `**@${username}**${when} —${quote}`
  })

  const lead =
    items.length === 1
      ? 'Z feedu wyłapałem jedno:'
      : 'Co ostatnio krąży na feedzie:'
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nJest jeszcze parę wpisów — zerknij na zakładkę Feed.`
      : ''
  return `${lead}\n${body}${tail}`
}

/** Mapowanie `calendar_entries.kind` enum (9 wartości) → polskie etykiety. */
const CALENDAR_KIND_PL: Record<string, string> = {
  lecturer_absence: 'nieobecność wykładowcy',
  class_cancelled: 'odwołane zajęcia',
  class_remote: 'zdalne zajęcia',
  class_rescheduled: 'przeniesione zajęcia',
  duty_change: 'zmiana dyżuru',
  free_day: 'dzień wolny',
  official_event: 'wydarzenie UJ',
  community_event: 'wydarzenie społeczności',
  deadline: 'deadline',
}

const MAX_CALENDAR_TO_SHOW = 6

function formatCalendarResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'W tym zakresie nic nie ma w kalendarzu.'
  }
  const items = rawItems.slice(0, MAX_CALENDAR_TO_SHOW)
  const remaining = rawItems.length - items.length

  const sentences = items.map((item) => {
    const kind = pickString(item, 'kind')
    const kindLabel = CALENDAR_KIND_PL[kind] ?? 'wpis'
    const title = pickString(item, 'title') || 'wpis'
    const startsAt = pickStringOrNull(item, 'starts_at')
    const lecturer = pickStringOrNull(item, 'lecturer_name')
    const location = pickStringOrNull(item, 'location')

    const ctx = eventDateContext(startsAt)
    const datePart = startsAt
      ? ctx
        ? `${ctx} (${formatDateShort(startsAt)})`
        : formatDateShort(startsAt)
      : 'bez daty'
    const lecturerPart = lecturer ? ` — ${lecturer}` : ''
    const locPart = location ? ` w ${location}` : ''
    return `**${title}** [${kindLabel}] ${datePart}${lecturerPart}${locPart}`
  })

  const lead =
    items.length === 1
      ? 'Mam jeden wpis:'
      : `W tym zakresie ${items.length} rzeczy:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nJest jeszcze ${remaining} — zawęź zakres albo zerknij na Kalendarz.`
      : ''
  return `${lead}\n${body}${tail}`
}

/** Mapowanie `student_discounts.category` enum (10 wartości) na PL etykiety. */
const DISCOUNT_CATEGORY_PL: Record<string, string> = {
  jedzenie: 'jedzenie',
  kawa: 'kawa',
  kultura: 'kultura',
  kino: 'kino',
  sport: 'sport',
  ksiazki: 'książki',
  uslugi: 'usługi',
  transport: 'transport',
  odziez: 'odzież',
  inne: 'inne',
}

const MAX_DISCOUNTS_TO_SHOW = 5

function pickNumber(obj: unknown, key: string): number | null {
  if (typeof obj !== 'object' || obj === null) return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function formatDiscountsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Nic mi nie pasuje — spróbuj inną kategorią albo hasłem.'
  }
  const items = rawItems.slice(0, MAX_DISCOUNTS_TO_SHOW)
  const remaining = rawItems.length - items.length

  const sentences = items.map((item) => {
    const business = pickString(item, 'business_name') || 'lokal'
    const headline = pickString(item, 'discount_headline')
    const address = pickStringOrNull(item, 'address')

    const where = address ? ` (${address.replace(', Kraków', '')})` : ''
    return `**${business}**${where} — ${headline}`
  })

  const lead =
    items.length === 1 ? 'Mam coś:' : `Spoko, ${items.length} rzeczy:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nWięcej jest w zakładce Zniżki.`
      : ''
  return `${lead}\n${body}${tail}`
}

function formatTrendingDiscountsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Cisza, w tym tygodniu nikt jeszcze niczego nie aktywował. Zerknij na zakładkę Zniżki — coś musi być świeże.'
  }
  const items = rawItems.slice(0, 4)

  const sentences = items.map((item) => {
    const business = pickString(item, 'business_name') || 'lokal'
    const headline = pickString(item, 'discount_headline')
    const recentUses = pickNumber(item, 'recent_uses') ?? 0
    const usesPart = recentUses > 0 ? ` (${recentUses}× w tym tygodniu)` : ''
    return `**${business}** — ${headline}${usesPart}`
  })

  const lead = 'Najgorętsze zniżki w tym tygodniu:'
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  return `${lead}\n${body}`
}

const MAX_CLASSES_TO_SHOW = 8

function formatMyClassesResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Wolne, nic nie masz w planie. Jeśli to błąd — wpadnij na „Mój Plan" i odśwież import z USOSweb.'
  }
  const items = rawItems.slice(0, MAX_CLASSES_TO_SHOW)
  const remaining = rawItems.length - items.length
  const cancelledCount = items.filter(
    (i) => pickStringOrNull(i, 'cancelled_announcement_body') !== null,
  ).length

  const sentences = items.map((item) => {
    const summary = pickString(item, 'summary') || 'zajęcia'
    const start = pickStringOrNull(item, 'start_time')
    const lecturer = pickStringOrNull(item, 'lecturer_name')
    const location = pickStringOrNull(item, 'location')
    const cancelledBody = pickStringOrNull(item, 'cancelled_announcement_body')

    const ctx = eventDateContext(start)
    const datePart = start
      ? ctx
        ? `${ctx} (${formatDateShort(start)})`
        : formatDateShort(start)
      : 'bez daty'
    const lec = lecturer ? `, ${lecturer}` : ''
    const sala = location ? ` — sala ${location}` : ''
    const cancelTag = cancelledBody ? ' [ODWOŁANE]' : ''
    return `**${summary}**${cancelTag} ${datePart}${lec}${sala}`
  })

  const cancelNote =
    cancelledCount > 0
      ? cancelledCount === 1
        ? ' Uwaga, jedne odwołane.'
        : ` Uwaga, ${cancelledCount} odwołane.`
      : ''
  const lead =
    items.length === 1
      ? `Masz jedne zajęcia.${cancelNote}`
      : `Masz ${items.length} zajęć w tym zakresie.${cancelNote}`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nJest jeszcze ${remaining} dalej — zawęź zakres jeśli chcesz.`
      : ''
  return `${lead}\n${body}${tail}`
}

/** Briefing tool zwraca już-renderowany string. Pass-through. */
function formatWeeklyBriefingResult(result: unknown): string {
  if (typeof result === 'string') return result
  if (typeof result !== 'object' || result === null) {
    return 'Briefingu na ten tydzień jeszcze nie ma — wejdź na zakładkę Briefing, system go policzy.'
  }
  const r = result as Record<string, unknown>
  if (typeof r.markdown === 'string' && r.markdown.length > 0) {
    return r.markdown
  }
  return 'Briefingu na ten tydzień jeszcze nie ma — wejdź na zakładkę Briefing, system go policzy.'
}

const MAX_USOS_TO_SHOW = 5

function formatUpcomingUsosResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'W tym okresie nic nadchodzącego nie ma w bazie. Zerknij na zakładkę Rejestracje — może akurat ktoś dorzuca.'
  }
  const items = rawItems.slice(0, MAX_USOS_TO_SHOW)
  const remaining = rawItems.length - items.length

  const sentences = items.map((item) => {
    const title = pickString(item, 'title') || 'rejestracja'
    const opensAt = pickStringOrNull(item, 'opens_at')
    const audience = pickStringOrNull(item, 'audience_label')

    const ctx = eventDateContext(opensAt)
    const datePart = opensAt
      ? ctx
        ? `${ctx} (${formatDateShort(opensAt)})`
        : formatDateShort(opensAt)
      : 'bez daty'
    const audPart = audience ? `, ${audience}` : ''
    return `**${title}** — start ${datePart}${audPart}`
  })

  const lead =
    items.length === 1
      ? 'Nadchodzi jedna rejestracja:'
      : `${items.length} rejestracji w drodze:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0
      ? `\n\nWięcej w zakładce Rejestracje.`
      : ''
  return `${lead}\n${body}${tail}`
}

const MAX_OFFICIAL_EVENTS_TO_SHOW = 5

function formatUpcomingOfficialEventsResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Cisza, nic nadchodzącego nie ma w bazie. Sprawdź zakładkę Wydarzenia — coś musi wkrótce wpaść.'
  }
  const items = rawItems.slice(0, MAX_OFFICIAL_EVENTS_TO_SHOW)
  const remaining = rawItems.length - items.length

  const sentences = items.map((item) => {
    const title = pickString(item, 'title') || 'wydarzenie'
    const date = pickStringOrNull(item, 'date')
    const location = pickStringOrNull(item, 'location')

    const ctx = eventDateContext(date)
    const datePart = date
      ? ctx
        ? `${ctx} (${formatDateShort(date)})`
        : formatDateShort(date)
      : 'bez daty'
    const locPart = location ? ` w ${location}` : ''
    return `**${title}** — ${datePart}${locPart}`
  })

  const lead =
    items.length === 1
      ? 'Nadchodzi jedno wydarzenie:'
      : `${items.length} wydarzeń przed Tobą:`
  const body =
    items.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  const tail =
    remaining > 0 ? `\n\nWięcej w zakładce Wydarzenia.` : ''
  return `${lead}\n${body}${tail}`
}

/**
 * Główny serwerowy formatter wyniku narzędzia → finalna odpowiedź dla
 * użytkownika. Wywoływany w miejsce drugiego round-tripu do Groqa
 * (który wcześniej "syntetyzował" odpowiedź z wyniku narzędzia).
 *
 * Strategia per shape:
 *   - `string` → wynik już jest tekstem (np. `EMPTY_RESULT_MESSAGE`),
 *     zwracamy jak jest;
 *   - `{ ok: false, error }` → krótka, neutralna informacja o błędzie
 *     (bez wyciekania szczegółów Postgres do usera);
 *   - `{ items: [] }` per nazwa tool-a → markdown-lista.
 *
 * Każdy nieznany shape → krótkie `Otrzymałem dane, ale nie umiem ich
 * przedstawić.` (defensive, lepsze niż wyrzucenie surowego JSON-a).
 */
function formatToolResultAsFinalAnswer(
  toolName: string,
  result: unknown,
): string {
  if (typeof result === 'string') return result
  if (isToolErrorObject(result)) {
    const errMsg =
      typeof (result as { error?: unknown }).error === 'string'
        ? (result as { error: string }).error
        : 'nieznany błąd'
    console.warn(
      '[Tool Format] tool returned error result:',
      toolName,
      'error:',
      errMsg,
    )
    return `Nie wyszło — ${errMsg}.`
  }
  switch (toolName) {
    case 'search_events':
      return formatSearchEventsResult(result)
    case 'get_latest_announcements':
      return formatAnnouncementsResult(result)
    case 'get_latest_posts':
      return formatPostsResult(result)
    case 'get_calendar_in_range':
      return formatCalendarResult(result)
    case 'search_discounts':
      return formatDiscountsResult(result)
    case 'get_trending_discounts':
      return formatTrendingDiscountsResult(result)
    case 'get_my_classes_in_range':
      return formatMyClassesResult(result)
    case 'get_my_weekly_briefing':
      return formatWeeklyBriefingResult(result)
    case 'get_upcoming_usos_registrations':
      return formatUpcomingUsosResult(result)
    case 'get_upcoming_official_events':
      return formatUpcomingOfficialEventsResult(result)
    case 'find_lecturer':
      return formatFindLecturerResult(result)
    case 'get_lecturer_announcements_by_name':
      return formatLecturerAnnouncementsResult(result)
    case 'get_my_followed_lecturers':
      return formatMyFollowedLecturersResult(result)
    default:
      console.warn('[Tool Format] no formatter for tool:', toolName)
      return 'Mam dane, ale nie wiem jak je przedstawić.'
  }
}

function formatFindLecturerResult(result: unknown): string {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Nikogo takiego nie mam w bazie. Może literówka?'
  }
  const items = rawItems.slice(0, 5)
  const sentences = items.map((item) => {
    const name = pickString(item, 'lecturer_name') || 'wykładowca'
    const count = pickNumber(item, 'announcement_count') ?? 0
    const latest = pickStringOrNull(item, 'latest_at')
    const countPart =
      count > 0 ? ` — ${count} ${count === 1 ? 'ogłoszenie' : 'ogłoszeń'}` : ''
    const latestPart = latest ? ` (ostatnio ${formatRelativeDate(latest)})` : ''
    return `**${name}**${countPart}${latestPart}`
  })
  if (items.length === 1) {
    return `Mam jednego: ${sentences[0]}.`
  }
  return `${items.length} pasuje:\n${sentences.join('\n')}`
}

function formatLecturerAnnouncementsResult(result: unknown): string {
  if (typeof result === 'string') return result
  if (typeof result !== 'object' || result === null) {
    return 'Coś poszło nie tak — spróbuj ponownie.'
  }
  const r = result as Record<string, unknown>
  const lecturer = typeof r.lecturer_name === 'string' ? r.lecturer_name : null
  const items = Array.isArray(r.items) ? r.items : []
  if (items.length === 0) {
    return lecturer
      ? `**${lecturer}** — w bazie znaleziony, ale brak ogłoszeń. Spokojny wykładowca.`
      : 'Brak ogłoszeń.'
  }
  const top = items.slice(0, 5)
  const sentences = top.map((it) => {
    const status = pickString(it, 'status')
    const statusPl = ANNOUNCEMENT_STATUS_PL[status] ?? status
    const body = pickString(it, 'body')
    const created = pickStringOrNull(it, 'created_at')
    const when = created ? ` (${formatRelativeDate(created)})` : ''
    const tail = body ? ` — ${clip(body, 160)}` : ''
    return `${statusPl}${when}${tail}`
  })
  const lead = `**${lecturer ?? 'Wykładowca'}** — co ostatnio:`
  const body = top.length <= 2 ? sentences.join(' ') : sentences.join('\n')
  return `${lead}\n${body}`
}

function formatMyFollowedLecturersResult(result: unknown): string {
  if (typeof result === 'string') return result
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return 'Jeszcze nikogo nie subskrybujesz. Wpadnij w „Mój Plan" i dodaj swoich wykładowców.'
  }
  const items = rawItems.slice(0, 8)
  const totalRecent = items.reduce(
    (sum, it) => sum + (pickNumber(it, 'recent_announcement_count') ?? 0),
    0,
  )

  const sentences = items.map((it) => {
    const name = pickString(it, 'display_name') || 'wykładowca'
    const recent = pickNumber(it, 'recent_announcement_count') ?? 0
    const latest = pickStringOrNull(it, 'latest_announcement_at')
    const status = pickStringOrNull(it, 'latest_status')
    const statusPl = status ? ANNOUNCEMENT_STATUS_PL[status] ?? status : null
    const recentPart =
      recent > 0
        ? ` — ${recent} ${recent === 1 ? 'ogłoszenie' : 'ogłoszeń'}`
        : ' — cisza'
    const latestPart =
      latest && statusPl
        ? ` (ostatnio: ${statusPl}, ${formatRelativeDate(latest)})`
        : ''
    return `**${name}**${recentPart}${latestPart}`
  })

  const lead =
    totalRecent === 0
      ? `Subskrybujesz ${items.length} ${items.length === 1 ? 'wykładowcę' : 'wykładowców'}, ale ostatnio cisza:`
      : `Subskrybujesz ${items.length} ${items.length === 1 ? 'wykładowcę' : 'wykładowców'}, ostatnio ${totalRecent} ${totalRecent === 1 ? 'komunikat' : 'komunikatów'}:`
  return `${lead}\n${sentences.join('\n')}`
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

  const conversation: GroqMessage[] = withPersona(pruned)

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
    '[Tool Routing] last user (first 60ch):',
    JSON.stringify(lastUserText.slice(0, 60)),
    '| useTools:',
    useTools,
    '| intent:',
    routedIntent,
    '| toolsSent:',
    effectiveTools.length,
    '/',
    tools.length,
  )

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
        const formatted = formatToolResultAsFinalAnswer(
          fastMatch.toolName,
          result,
        )
        // Zapisz do response cache — kolejne identyczne zapytania pójdą
        // przez `responseCache HIT` (jeszcze szybciej, bez nawet Supabase).
        // Zostawiamy ten sam `RESPONSE_CACHE_TTL_SECONDS` (60s) co Groq path
        // — spójność i mała ekspozycja na stale data.
        await kvSetSafe(responseCacheKey, formatted, RESPONSE_CACHE_TTL_SECONDS)
        // Fragmentowany strumień + meta — klient pokaże „Sprawdzam zniżki…"
        // zamiast losowych thinking-phrases, bo ZNAMY tool name z wyprzedzeniem.
        const fastPathLabel = getActionLabel(fastMatch.toolName)
        void incrCounter('fast_path:hit')
        void incrCounter(`fast_path:tool:${fastMatch.toolName}`)
        void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
        void pushLatency('chat:fast_path_ms', Date.now() - requestStartedAt)
        return streamFinalContentChunked(
          formatted,
          fastPathLabel
            ? { tool: fastMatch.toolName, label: fastPathLabel }
            : null,
        )
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
  /**
   * Akumulator tokenów — sumuje `usage` z odpowiedzi Groqa. Single-shot więc
   * dokładnie 1 wpis (vs poprzednie pętle), ale interfejs zostaje dla spójności
   * i ewentualnej rozbudowy.
   */
  const usageAcc = new TokenUsageAccumulator()
  let resolvedModel = DEFAULT_GROQ_MODEL

  try {
    type Completion = Awaited<ReturnType<GroqProvider['completeWithTools']>>
    let completion: Completion | null = null
    // Mały model dla ścieżki SMALL-TALK (brak tools, „cześć/dzięki/spoko").
    // qwen3-32b kosztowałby ~5× więcej i odpowiadał ~3× wolniej dla
    // 4-słownej grzeczności. Cap też niżej (200 tok) — small-talk reply
    // nigdy nie potrzebuje więcej.
    const isSmallTalkPath = !useTools
    const completeOpts = isSmallTalkPath
      ? { model: GROQ_SMALLTALK_MODEL, maxTokens: 200 }
      : undefined
    if (isSmallTalkPath) {
      void incrCounter('groq:small_talk_path')
      console.log(
        '[Groq] small-talk path — model:',
        GROQ_SMALLTALK_MODEL,
        '| maxTokens: 200',
      )
    }
    // Circuit breaker — gdy ostatnie N requestów do Groqa padło 429/5xx,
    // odmawiamy NATYCHMIAST z friendly message zamiast czekać 3-5s na
    // timeout. Stan trzymany w KV (cross-instance), fail-open przy
    // niedostępnym KV. Patrz `groqCircuitBreaker.ts`.
    const cbDecision = await cbGate()
    if (!cbDecision.allow) {
      console.warn(
        '[Groq CB] OPEN — refusing request, retryAfter:',
        cbDecision.retryAfterSec,
        's',
      )
      void incrCounter('groq:cb:short_circuit')
      const message = CIRCUIT_OPEN_MESSAGE_TEMPLATE(cbDecision.retryAfterSec)
      void pushLatency('chat:total_ms', Date.now() - requestStartedAt)
      return streamFinalContentChunked(message, null)
    }
    if (cbDecision.state === 'HALF_OPEN') {
      console.log('[Groq CB] HALF_OPEN — letting probe request through')
      void incrCounter('groq:cb:probe')
    }
    try {
      completion = await provider.completeWithTools(
        conversation,
        effectiveTools,
        completeOpts,
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
      } else {
        // Ścieżka B: model poprosił o narzędzia. Wykonujemy każde i
        // formatujemy WYNIKI tools jako finalną odpowiedź — BEZ drugiego
        // round-tripu do Groqa na "syntezę". To eliminuje ~50% calls do
        // LLM w typowej ścieżce z tools.
        console.log(
          '[Tool Flow] got',
          toolCalls.length,
          'tool_call(s) — executing and formatting server-side (no LLM synthesis)',
        )
        // Parallel execution — gdy Groq zwraca 2+ tool calls (np. „co dziś
        // i jakie zniżki"), wołamy je RÓWNOLEGLE zamiast sekwencyjnie.
        // Tools są niezależne (każde czyta inną tabelę Supabase), więc nic
        // nie blokuje. `Promise.all` zachowuje kolejność, więc `sections[i]`
        // odpowiada `toolCalls[i]` — semantyka taka sama jak przy
        // sekwencyjnym for.
        const sections = await Promise.all(
          toolCalls.map(async (call) => {
            const result = await runToolCall(call, ctx)
            return formatToolResultAsFinalAnswer(call.function.name, result)
          }),
        )
        finalContent = joinToolSections(sections)
        // Pierwszy tool — najwierniejszy obraz aktywności (przy multi-call
        // wybieramy ten pierwszy zgodnie z kolejnością modelu). Klient
        // pokazuje tę etykietę w typing-indicatorze tylko do pierwszego
        // delta-content; potem już animowany typewriter pisze odpowiedź.
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
      '| first 120 chars:',
      JSON.stringify(finalContent.slice(0, 120)),
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
  // naturalny feed. Dorzucamy meta event z `tool` + `label` jeśli wiemy,
  // którego narzędzia model użył — UI pokaże „Sprawdzam zniżki…" zamiast
  // losowych „Myślę…".
  const finalLabel = executedToolName ? getActionLabel(executedToolName) : null
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
      ? { tool: executedToolName, label: finalLabel }
      : null,
  )
}
