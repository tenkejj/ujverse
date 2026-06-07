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
import { kvGetSafe, kvSetSafe } from './_lib/kvCache.js'
import { DEFAULT_GROQ_MODEL, withPersona } from './_lib/llmService.js'
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
/** Komunikat zwracany użytkownikowi gdy Groq odpowie 429 (rate limit / quota). */
const RATE_LIMIT_USER_MESSAGE = 'System przeciążony (Rate Limit). Spróbuj za minutę.'
const ALLOWED_ROLES = new Set<ChatRole>(['system', 'user', 'assistant'])

/**
 * Response cache TTL (sekundy) — finalna odpowiedź dla danej pary
 * (lastUserText, useTools) jest cache'owana w Vercel KV (Upstash Redis)
 * na 300 sekund (5 minut).
 *
 * Skutek przy trafieniu: NIE wołamy Groqa ANI Supabase — od razu strumień
 * SSE z odpowiedzią sprzed maks. 5 minut. To trzecia warstwa redukcji
 * 429-ek (po small-talk throttle i per-tool cache), działająca CROSS-instance
 * (KV jest globalny w przeciwieństwie do starego in-memory cache, który
 * tracił hity przy każdym cold-startcie Edge function).
 *
 * Trade-off przy 300s: świeżość odpowiedzi vs koszt LLM. Dla typowych
 * zapytań UJverse ("kiedy juwenalia", "ogłoszenia") 5 min jest akceptowalne;
 * dla dyskusji bardzo dynamicznych (świeże posty z `get_latest_posts`)
 * niedoskonałe — ale tool cache TTL dla postów to 30s, więc PER-TOOL cache
 * w `registry.ts` mimo wszystko zapewnia świeżość gdy response cache pęknie.
 */
const RESPONSE_CACHE_TTL_SECONDS = 300

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
 * Token Budgeting helper — przycina historię konwersacji do ostatnich
 * `MAX_HISTORY_MESSAGES` wiadomości. Wyodrębnione jako osobna funkcja
 * (z explicit return) żeby było łatwe do testowania w izolacji oraz
 * żeby orchestrator pozostał czytelny w hot path.
 *
 * System prompt nie liczy się do tego budżetu — `withPersona` dokleja
 * personę po przycięciu, więc tnie się czysta historia user/assistant.
 */
export function pruneHistory(messages: GroqMessage[]): GroqMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages
  return messages.slice(-MAX_HISTORY_MESSAGES)
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

function formatSearchEventsResult(result: unknown): string {
  const items = getItemsArray(result)
  if (!items || items.length === 0) {
    return 'Nie znalazłem wydarzeń pasujących do zapytania.'
  }
  const lines: string[] = [`Znalazłem ${items.length} wydarzeń:`, '']
  items.forEach((item, idx) => {
    const title = pickString(item, 'title') || '(bez tytułu)'
    const location = pickString(item, 'location')
    const date = pickStringOrNull(item, 'date')
    const description = pickString(item, 'description')
    const isOfficial = pickBool(item, 'is_official')
    const officialMark = isOfficial ? ' _(oficjalne UJ)_' : ''
    lines.push(`${idx + 1}. **${title}**${officialMark}`)
    lines.push(`   - Data: ${formatDateShort(date)}`)
    if (location) lines.push(`   - Miejsce: ${location}`)
    if (description) lines.push(`   - ${clip(description, 240)}`)
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}

function formatAnnouncementsResult(result: unknown): string {
  const items = getItemsArray(result)
  if (!items || items.length === 0) {
    return 'Brak aktualnych ogłoszeń.'
  }
  const lines: string[] = [`Najnowsze ogłoszenia (${items.length}):`, '']
  items.forEach((item, idx) => {
    const lecturer =
      pickString(item, 'lecturer_name_nominative') || '(nieznany wykładowca)'
    const statusKey = pickString(item, 'status')
    const status = ANNOUNCEMENT_STATUS_PL[statusKey] ?? statusKey ?? 'komunikat'
    const body = pickString(item, 'body')
    const department = pickStringOrNull(item, 'department')
    const createdAt = pickStringOrNull(item, 'created_at')
    lines.push(`${idx + 1}. **${lecturer}** — ${status}`)
    if (body) lines.push(`   - ${clip(body, 240)}`)
    if (department) lines.push(`   - Wydział: ${department}`)
    if (createdAt) lines.push(`   - Data: ${formatDateShort(createdAt)}`)
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}

function formatPostsResult(result: unknown): string {
  const items = getItemsArray(result)
  if (!items || items.length === 0) {
    return 'Brak postów do pokazania.'
  }
  const lines: string[] = [`Najnowsze posty społeczności (${items.length}):`, '']
  items.forEach((item, idx) => {
    const author = (typeof item === 'object' && item !== null
      ? (item as Record<string, unknown>).author
      : null) as Record<string, unknown> | null
    const username =
      (author && typeof author.username === 'string' && author.username) || 'anon'
    const department =
      (author && typeof author.department === 'string' && author.department) ||
      null
    const body = pickString(item, 'body')
    const tags = pickStringArray(item, 'tags')
    const createdAt = pickStringOrNull(item, 'created_at')
    const deptSuffix = department ? ` _(${department})_` : ''
    lines.push(`${idx + 1}. **@${username}**${deptSuffix}`)
    if (body) lines.push(`   - ${clip(body, 240)}`)
    if (tags.length > 0) {
      const tagLine = tags.map((t) => `#${t}`).join(' ')
      lines.push(`   - Tagi: ${tagLine}`)
    }
    if (createdAt) lines.push(`   - Data: ${formatDateShort(createdAt)}`)
    lines.push('')
  })
  return lines.join('\n').trimEnd()
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
    return `Nie udało mi się pobrać danych (${errMsg}).`
  }
  switch (toolName) {
    case 'search_events':
      return formatSearchEventsResult(result)
    case 'get_latest_announcements':
      return formatAnnouncementsResult(result)
    case 'get_latest_posts':
      return formatPostsResult(result)
    default:
      console.warn('[Tool Format] no formatter for tool:', toolName)
      return 'Otrzymałem dane, ale nie umiem ich przedstawić.'
  }
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
    return 'Przepraszam, nie udało mi się dokończyć odpowiedzi. Spróbuj ponownie.'
  }
  return nonEmpty.join('\n\n---\n\n')
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

  // Tool-call throttling: czy ostatnia wiadomość użytkownika WYMAGA dostępu
  // do bazy? Dla małej rozmowy ("cześć", "dzięki", "ok") puszczamy zapytanie
  // BEZ schematów `tools`, oszczędzając tokeny wejściowe i eliminując jedną
  // iterację pętli (model nie ma co odpalić). To bezpośredni hit w częstotliwość
  // wywołań Groqa, więc obniża szansę na 429.
  const lastUserText = lastUserMessageContent(inboundMessages)
  const useTools = shouldUseTools(lastUserText)
  const effectiveTools = useTools ? tools : []
  console.log(
    '[Tool Throttle] last user (first 60ch):',
    JSON.stringify(lastUserText.slice(0, 60)),
    '| useTools:',
    useTools,
    '| toolsSent:',
    effectiveTools.length,
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
    console.log(
      '[Response Cache] HIT key:',
      responseCacheKey,
      '| len:',
      cachedReply.length,
      '— skipping Groq AND Supabase',
    )
    return streamFinalContent(cachedReply)
  }
  console.log('[Response Cache] MISS key:', responseCacheKey)

  let finalContent = ''
  /**
   * 429 z Groqa NIE jest błędem fatalnym dla użytkownika — to przejściowy
   * stan przeciążenia. Zamiast zwracać HTTP 429 (UI pokazałby toast "Asystent
   * nie odpowiada"), wsadzamy łagodny komunikat do strumienia SSE, dokładnie
   * tak jakby model sam to powiedział.
   */
  let rateLimited = false
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
    try {
      completion = await provider.completeWithTools(conversation, effectiveTools)
    } catch (err) {
      if (err instanceof GroqProviderError && err.status === 429) {
        console.warn('[api/chat] Groq 429 (rate limit) — graceful degrade for user')
        rateLimited = true
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
        // sensownego narzędzia). Jego content idzie 1:1 do usera.
        finalContent = assistantMessage.content ?? ''
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
        const sections: string[] = []
        for (const call of toolCalls) {
          const result = await runToolCall(call, ctx)
          sections.push(formatToolResultAsFinalAnswer(call.function.name, result))
        }
        finalContent = joinToolSections(sections)
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

  return streamFinalContent(guardedContent)
}
