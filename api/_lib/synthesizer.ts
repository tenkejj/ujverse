/** Format public tool facts directly where possible; use the small model for synthesis. */

import {
  GroqProvider,
  type GroqStreamChunk,
  type GroqUsage,
} from './GroqProvider.js'
import { GROQ_SMALLTALK_MODEL, withGroqRetry } from './llmService.js'
import {
  SYNTHESIS_SYSTEM_PROMPT,
  SYNTHESIS_USER_INSTRUCTION,
} from './persona.js'
import { softenTranslationese } from './polishNaturalize.js'
import type { GroqMessage } from './types.js'

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Wynik `buildToolFacts`. Albo gotowa odpowiedź ('direct' — empty/error/
 * passthrough), albo fakty do syntezy ('synthesize' — mniejszy model robi resztę).
 */
export type ToolFactsResult =
  | { kind: 'direct'; text: string }
  | {
      kind: 'synthesize'
      facts: string
      hint: string | null
      topicHint: string
    }

/**
 * Kompaktowa synteza bez LLM — gdy jest dokładnie 1 krótki fakt.
 * Oszczędza wywołanie mniejszego modelu przy pojedynczym krótkim wyniku.
 */
export function tryCompactSynthesis(
  _userQuery: string,
  facts: string,
  hint: string | null,
): string | null {
  const lines = facts
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length !== 1) return null
  const line = lines[0]!
  if (line.length < 12 || line.length > 600) return null
  if (hint && hint.length > 240) return null

  const tail = hint ? `\n\n${hint.trim()}` : ''
  return `${line}${tail}`
}

/** Stosuj po złożeniu odpowiedzi z LLM lub kompaktowej syntezy. */
export function polishAssistantReply(text: string): string {
  return softenTranslationese(text)
}

/** Remaining unstructured facts: 1 → compact, 2–3 → model, 4+ → list. Common catalogues bypass this as direct replies. */
export const LLM_SYNTHESIS_MIN_LINES = 2
export const LLM_SYNTHESIS_MAX_LINES = 3
export const LIST_FORMAT_MIN_LINES = 4

export function countFactLines(facts: string): number {
  return facts
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length
}

export function shouldUseLlmSynthesis(facts: string): boolean {
  const n = countFactLines(facts)
  return n >= LLM_SYNTHESIS_MIN_LINES && n <= LLM_SYNTHESIS_MAX_LINES
}

export function shouldFormatAsBulletList(facts: string): boolean {
  return countFactLines(facts) >= LIST_FORMAT_MIN_LINES
}

function conversationalListLead(topicHint: string): string {
  if (/rejestracje USOS/i.test(topicHint))
    return 'W pobranych terminach znalazłem te rejestracje. Przy każdej podaję, kiedy można się zapisać:'
  if (/oficjalne wydarzenia/i.test(topicHint))
    return 'Znalazłem te wydarzenia w kalendarzu UJ. Zerknij, co pasuje Ci terminem:'
  if (/plan zajęć/i.test(topicHint))
    return 'Zajrzałem do Twojego zapisanego planu. W wybranym terminie widzę:'
  if (/ogłoszenia wykładowcy /i.test(topicHint))
    return `${topicHint.trim().replace(/\.$/, '')}. Znalazłem te wpisy:`
  if (/ogłosze|komunikat/i.test(topicHint))
    return 'Znalazłem te komunikaty. Przy każdym zostawiam link, żeby łatwo sprawdzić szczegóły:'
  if (/kalendarz/i.test(topicHint))
    return 'Zajrzałem do kalendarza — w tym zakresie znalazłem:'
  if (/zniżki/i.test(topicHint))
    return 'Mam kilka propozycji z bazy zniżek. Przed skorzystaniem sprawdź warunki oferty:'
  if (/wykładowc/i.test(topicHint))
    return 'Znalazłem te osoby w bazie wykładowców:'
  if (/wydarzenia/i.test(topicHint))
    return 'Znalazłem te wydarzenia pasujące do pytania:'
  return 'Oto, co udało mi się znaleźć:'
}

/** Common catalogues need a helpful voice, not a second model call to paraphrase dates. */
function catalogueReply(
  facts: string,
  hint: string | null,
  topicHint: string,
): ToolFactsResult {
  const lines = facts.split('\n').filter((line) => line.trim().length > 0)
  const body =
    lines.length === 1 ? lines[0] : lines.map((line) => `- ${line}`).join('\n')
  return {
    kind: 'direct',
    text: `${conversationalListLead(topicHint)}\n\n${body}${formatListClosingHint(hint)}`,
  }
}

function formatListClosingHint(hint: string | null): string {
  return hint ? `\n\n${hint.trim()}` : ''
}

/**
 * Lista faktów bez drugiego wywołania modelu (4+ wyników). Linie są już po
 * polsku (tytuł, data, miejsce, link). Przy 2–3 wynikach zwraca `null`, żeby
 * caller poszedł w syntezę LLM — krótsza proza brzmi naturalniej niż bullet.
 */
export function formatListedFacts(
  facts: string,
  hint: string | null,
  topicHint: string,
): string | null {
  const lines = facts
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return null
  if (!shouldFormatAsBulletList(facts)) return null

  const lead = conversationalListLead(topicHint)
  const bullets = lines
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
    .join('\n')
  const tail = formatListClosingHint(hint)
  return `${lead}\n${bullets}${tail}`
}

/** Fallback bez LLM: compact → lista → surowe fakty + hint. */
export function formatFactsFallback(
  userQuery: string,
  facts: string,
  hint: string | null,
  topicHint: string,
): string {
  return (
    tryCompactSynthesis(userQuery, facts, hint) ??
    formatListedFacts(facts, hint, topicHint) ??
    (hint ? `${facts}\n\n${hint}` : facts)
  )
}

function buildSynthesisUserContent(opts: SynthesisOptions): string {
  const { userQuery, facts, hint, topicHint } = opts
  return [
    `Pytanie: ${userQuery}`,
    `Temat: ${topicHint}`,
    'Fakty (jedna linia = jeden wynik):',
    facts,
    ...(hint ? [`Dodatkowa informacja: ${hint}`] : []),
    SYNTHESIS_USER_INSTRUCTION,
  ].join('\n')
}

export type SynthesisOptions = {
  userQuery: string
  facts: string
  hint: string | null
  topicHint: string
  provider: GroqProvider
  signal?: AbortSignal
  /** Accepted for existing callers; the prompt no longer rotates forced openers. */
  recentOpeners?: readonly string[]
}

export type SynthesisResult = {
  text: string
  usage: GroqUsage | null
}

/**
 * Wywołuje mniejszy model Groq z faktami i pytaniem. Non-streaming
 * (`completeWithTools` z pustą tablicą tooli zachowuje się jak chat completion).
 *
 * Przy pustym wyniku caller może wyświetlić lokalnie sformatowane fakty.
 */
export async function synthesizeAnswer(
  opts: SynthesisOptions,
): Promise<SynthesisResult> {
  const { userQuery, facts, hint, topicHint, provider } = opts

  const compact = tryCompactSynthesis(userQuery, facts, hint)
  if (compact) {
    return { text: softenTranslationese(compact), usage: null }
  }

  const listed = formatListedFacts(facts, hint, topicHint)
  if (listed) {
    return { text: listed, usage: null }
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildSynthesisUserContent(opts),
    },
  ]

  // Shared retry policy retries transient failures; quota errors are not retried.
  const result = await withGroqRetry(() =>
    provider.completeWithTools(messages, [], {
      model: GROQ_SMALLTALK_MODEL,
      // GPT-OSS dolicza ukryty reasoning do `max_tokens`. 420 zjadało
      // widoczne zdanie albo zwracało pusty `content`. 1024 zostawia
      // miejsce na krótki chain-of-thought i pełną odpowiedź po polsku.
      maxTokens: 1024,
      // Keep factual synthesis restrained; preserve the reasoning/output budget.
      temperature: 0.4,
      toolChoice: 'none',
      signal: opts.signal,
    }),
  )

  const content =
    typeof result.message.content === 'string'
      ? result.message.content.trim()
      : ''

  return {
    text: softenTranslationese(content),
    usage: result.usage,
  }
}

/**
 * Streaming wariant `synthesizeAnswer` — emituje delty mniejszego modelu w locie.
 * Caller (`api/chat.ts`) przekazuje je klientowi w formacie SSE.
 *
 * Zwraca AsyncGenerator `GroqStreamChunk` (delta / done / error). Caller
 * powinien buforować całość do KV cache + markdown guard po `done`.
 *
 * NIE używamy `withGroqRetry` w streamie — retry SSE jest skomplikowany
 * (już mogliśmy wysłać delty do klienta). Caller decyduje o fallbacku:
 * przy błędzie przed pierwszą deltą caller formatuje dostępne fakty lokalnie.
 * Nie ponawia syntezy kolejnym wywołaniem modelu po wyczerpaniu limitu.
 */
export async function* streamAnswer(
  opts: SynthesisOptions,
): AsyncGenerator<GroqStreamChunk, void, void> {
  const { provider } = opts

  const messages: GroqMessage[] = [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    { role: 'user', content: buildSynthesisUserContent(opts) },
  ]

  yield* provider.streamCompletion(messages, [], {
    model: GROQ_SMALLTALK_MODEL,
    maxTokens: 1024,
    temperature: 0.4,
    toolChoice: 'none',
    signal: opts.signal,
  })
}

// =============================================================================
// FACT BUILDERS — extractory per tool. Zwracają DETERMINISTYCZNE fakty
// (taki sam input → taki sam string). Ułatwia debug i test snapshot.
// =============================================================================

import {
  ANNOUNCEMENT_STATUS_PL,
  CALENDAR_KIND_PL,
  DISCOUNT_CATEGORY_PL,
} from './toolEnums.js'
import {
  pickString,
  pickStringOrNull,
  pickStringArray,
  pickNumber,
  pickBool,
  isToolErrorObject,
  getItemsArray,
  formatRelativeDate,
  formatDateShort,
  eventDateContext,
  isSpamPost,
  clip,
} from './toolFormatHelpers.js'

const MAX_DISCOUNTS = 5
const MAX_EVENTS = 5
const MAX_ANNOUNCEMENTS = 5
const MAX_POSTS = 4
const MAX_CALENDAR = 6
const MAX_CLASSES = 8
const MAX_LECTURERS = 5

/**
 * Wybiera buildera per tool. Default'em zwraca 'direct' z generic message
 * (nieznany tool — bezpieczna ścieżka).
 */
export function buildToolFacts(
  toolName: string,
  result: unknown,
): ToolFactsResult {
  // Surowy string z toola (np. weekly briefing) — passthrough.
  if (typeof result === 'string') {
    if (
      toolName === 'get_my_classes_in_range' &&
      result.trim() === 'Brak zajęć w tym zakresie'
    ) {
      return buildMyClassesFacts({ items: [] })
    }
    return { kind: 'direct', text: result }
  }
  if (isToolErrorObject(result)) {
    const errMsg =
      typeof (result as { error?: unknown }).error === 'string'
        ? (result as { error: string }).error
        : 'nieznany błąd'
    return { kind: 'direct', text: `Nie wyszło — ${errMsg}.` }
  }

  switch (toolName) {
    case 'search_events':
      return buildSearchEventsFacts(result)
    case 'get_latest_announcements':
      return buildAnnouncementsFacts(result)
    case 'get_announcement_details':
      return buildAnnouncementDetailsFacts(result)
    case 'get_latest_posts':
      return buildPostsFacts(result)
    case 'get_calendar_in_range':
      return buildCalendarFacts(result)
    case 'search_discounts':
      return buildDiscountsFacts(result)
    case 'get_trending_discounts':
      return buildTrendingDiscountsFacts(result)
    case 'get_my_classes_in_range':
      return buildMyClassesFacts(result)
    case 'get_my_weekly_briefing':
      return buildWeeklyBriefingFacts(result)
    case 'get_upcoming_usos_registrations':
      return buildUpcomingUsosFacts(result)
    case 'get_upcoming_official_events':
      return buildUpcomingOfficialEventsFacts(result)
    case 'find_lecturer':
      return buildFindLecturerFacts(result)
    case 'get_lecturer_announcements_by_name':
      return buildLecturerAnnouncementsFacts(result)
    case 'get_my_followed_lecturers':
      return buildMyFollowedLecturersFacts(result)
    default:
      console.warn('[synthesizer] no fact builder for tool:', toolName)
      return {
        kind: 'direct',
        text: 'Mam dane, ale nie wiem jak je przedstawić.',
      }
  }
}

// -----------------------------------------------------------------------------
// search_discounts
// -----------------------------------------------------------------------------

function buildDiscountsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nic mi nie pasuje — spróbuj inną kategorią albo hasłem.',
    }
  }
  const items = rawItems.slice(0, MAX_DISCOUNTS)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
      const business = pickString(item, 'business_name') || 'lokal'
      const headline = pickString(item, 'discount_headline')
      const address = pickStringOrNull(item, 'address')
      const category = pickStringOrNull(item, 'category')
      const websiteUrl = pickStringOrNull(item, 'website_url')
      const catLabel = category
        ? (DISCOUNT_CATEGORY_PL[category] ?? category)
        : null
      const where = address ? address.replace(', Kraków', '') : null
      const businessLabel = websiteUrl
        ? `[${business}](${websiteUrl})`
        : business
      const parts: string[] = [businessLabel]
      if (where) parts.push(`— ${where}`)
      if (catLabel) parts.push(`[${catLabel}]`)
      parts.push(`— oferta: ${headline}`)
      return parts.join(' ')
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint:
      remaining > 0
        ? `w bazie jest jeszcze ${remaining} miejsc, więcej w zakładce Zniżki`
        : 'więcej opcji w zakładce Zniżki',
    topicHint:
      'Zniżki studenckie w Krakowie (baza UJverse) — user pyta co gdzie taniej.',
  }
}

// -----------------------------------------------------------------------------
// get_trending_discounts
// -----------------------------------------------------------------------------

function buildTrendingDiscountsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Cisza, w tym tygodniu nikt jeszcze niczego nie aktywował. Zerknij na zakładkę Zniżki — coś musi być świeże.',
    }
  }
  const items = rawItems.slice(0, 4)
  const facts = items
    .map((item) => {
      const business = pickString(item, 'business_name') || 'lokal'
      const headline = pickString(item, 'discount_headline')
      const recentUses = pickNumber(item, 'recent_uses') ?? 0
      const websiteUrl = pickStringOrNull(item, 'website_url')
      const usesPart = recentUses > 0 ? ` (${recentUses}× w tym tygodniu)` : ''
      const businessLabel = websiteUrl
        ? `[${business}](${websiteUrl})`
        : business
      return `${businessLabel} — ${headline}${usesPart}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint: null,
    topicHint: 'Najgorętsze zniżki studenckie w tym tygodniu.',
  }
}

// -----------------------------------------------------------------------------
// search_events
// -----------------------------------------------------------------------------

function buildSearchEventsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nic mi się nie znalazło. Spróbuj innego hasła albo zajrzyj na zakładkę Wydarzenia.',
    }
  }
  const items = rawItems.slice(0, MAX_EVENTS)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
      const title = pickString(item, 'title') || 'wydarzenie bez tytułu'
      const eventId = pickString(item, 'id')
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
      const titleLabel = eventId
        ? `[${title}](/events?open=${encodeURIComponent(eventId)})`
        : title
      return `${titleLabel}${tag} — ${datePart}${where}`
    })
    .join('\n')

  return catalogueReply(
    facts,
    remaining > 0
      ? `To część wyników. Pozostałe ${remaining} znajdziesz w zakładce Wydarzenia.`
      : null,
    'Wydarzenia w Krakowie (UJ + studenckie).',
  )
}

// -----------------------------------------------------------------------------
// get_latest_announcements
// -----------------------------------------------------------------------------

function buildAnnouncementsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nie znalazłem komunikatów pasujących do tego pytania w pobranych danych. Możesz podać wydział lub krótsze hasło — spróbujemy zawęzić szukanie.',
    }
  }
  const items = rawItems.slice(0, MAX_ANNOUNCEMENTS)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
      const lecturer =
        pickString(item, 'lecturer_name_nominative') || 'ktoś z kadry'
      const title = pickString(item, 'title') || lecturer
      const sourceUrl = pickStringOrNull(item, 'source_url')
      const statusKey = pickString(item, 'status')
      const statusPl = ANNOUNCEMENT_STATUS_PL[statusKey] ?? statusKey
      const body = pickString(item, 'body')
      const dept = pickStringOrNull(item, 'department')
      const createdAt = pickStringOrNull(item, 'created_at')

      const when = createdAt
        ? ` (dodano do UJverse ${formatRelativeDate(createdAt)})`
        : ''
      const deptTag = dept ? ` [${dept}]` : ''
      const tail = body ? ` — ${clip(body, 160)}` : ''
      const titleLabel = sourceUrl
        ? `[${title}](${sourceUrl})`
        : `[${title}](/komunikaty)`
      const sourceTail =
        sourceUrl && !tail.includes(sourceUrl) ? ` [źródło](${sourceUrl})` : ''
      return `${titleLabel} ${statusPl}${when}${deptTag}${tail}${sourceTail}`
    })
    .join('\n')

  return catalogueReply(
    facts,
    remaining > 0
      ? `To część wyników — pozostałe ${remaining} znajdziesz w [komunikatach](/komunikaty). Daty oznaczają dodanie do UJverse.`
      : 'Daty oznaczają dodanie do UJverse; ważne terminy potwierdź w źródle.',
    'Publiczne komunikaty wydziałów UJ.',
  )
}

// -----------------------------------------------------------------------------
// get_announcement_details — RAG search nad full-body
// -----------------------------------------------------------------------------

function buildAnnouncementDetailsFacts(result: unknown): ToolFactsResult {
  // Tool moze zwrocic surowy string ("Nie znalazlem ...") — direct passthrough.
  if (typeof result === 'string') {
    return { kind: 'direct', text: result }
  }
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nie ma komunikatów pasujących do tego pytania.',
    }
  }
  // Top 3 - synthesizer ma material zeby zlozyc zwiezla odpowiedz na konkret.
  const items = rawItems.slice(0, 3)
  const query =
    typeof result === 'object' && result !== null
      ? pickString(result, 'query')
      : ''

  const facts = items
    .map((item) => {
      const lecturer = pickString(item, 'lecturer_name') || 'ktoś z kadry'
      const statusKey = pickString(item, 'status')
      const statusPl = ANNOUNCEMENT_STATUS_PL[statusKey] ?? statusKey
      const dept = pickStringOrNull(item, 'department')
      const createdAt = pickStringOrNull(item, 'created_at')
      const excerpt = pickString(item, 'body_excerpt')
      const hasFull = pickBool(item, 'has_full_body')

      const when = createdAt ? ` (${formatRelativeDate(createdAt)})` : ''
      const deptTag = dept ? ` [${dept}]` : ''
      // Excerpt juz wycielismy w toolu z markerami "…" - przekazujemy 1:1.
      // hint dla syntezatora: gdy mamy full_body, mozemy powiedziec "wiecej w mailu".
      const fullHint = hasFull ? ' [+pełna treść w mailu]' : ''
      return `${lecturer} ${statusPl}${when}${deptTag}${fullHint} — ${excerpt}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint: query ? `User pytał o: "${query}"` : null,
    topicHint:
      'Konkretne ogłoszenia z bazy ISI UJ — user pyta o detal, nie o liste.',
  }
}

// -----------------------------------------------------------------------------
// get_latest_posts
// -----------------------------------------------------------------------------

function buildPostsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Cisza na feedzie — nikt nic ostatnio nie napisał.',
    }
  }
  const filtered = rawItems.filter((item) => {
    const body = pickString(item, 'body')
    const tags = pickStringArray(item, 'tags')
    return !isSpamPost(body, tags)
  })
  if (filtered.length === 0) {
    return {
      kind: 'direct',
      text: 'Coś tam jest, ale same krótkie wpisy, nic ciekawego do cytowania. Zerknij na zakładkę Feed.',
    }
  }
  const items = filtered.slice(0, MAX_POSTS)
  const remaining = filtered.length - items.length

  const facts = items
    .map((item) => {
      const author = (
        typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>).author
          : null
      ) as Record<string, unknown> | null
      const username =
        (author && typeof author.username === 'string' && author.username) ||
        'anon'
      const postId = pickString(item, 'id')
      const body = pickString(item, 'body')
      const createdAt = pickStringOrNull(item, 'created_at')
      const when = createdAt ? ` (${formatRelativeDate(createdAt)})` : ''
      const quote = body ? ` „${clip(body, 140)}"` : ''
      const authorLabel = postId
        ? `[@${username}](/thread/${encodeURIComponent(postId)})`
        : `@${username}`
      return `${authorLabel}${when} —${quote}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint: remaining > 0 ? `jeszcze parę wpisów na feedzie` : null,
    topicHint: 'Feed społeczności UJverse — krótkie cytaty wpisów, ton luźny.',
  }
}

// -----------------------------------------------------------------------------
// get_calendar_in_range
// -----------------------------------------------------------------------------

function buildCalendarFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'W tym zakresie nic nie ma w kalendarzu.',
    }
  }
  const items = rawItems.slice(0, MAX_CALENDAR)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
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
      const lecturerPart = lecturer ? `, ${lecturer}` : ''
      const locPart = location ? ` w ${location}` : ''
      return `${title} [${kindLabel}] ${datePart}${lecturerPart}${locPart}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint:
      remaining > 0 ? `jeszcze ${remaining} dalej, zerknij na Kalendarz` : null,
    topicHint: 'Kalendarz UJverse (nieobecności, odwołania, deadliny, eventy).',
  }
}

// -----------------------------------------------------------------------------
// get_my_classes_in_range
// -----------------------------------------------------------------------------

const timetableDayFormat = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})
const timetableTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Warsaw',
})
const timetableDateKey = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Europe/Warsaw',
})

function timetableWhen(startIso: string | null, endIso: string | null): string {
  const start = startIso ? new Date(startIso) : null
  if (!start || !Number.isFinite(start.getTime()))
    return 'brak potwierdzonej godziny'
  const end = endIso ? new Date(endIso) : null
  const endValid =
    end && Number.isFinite(end.getTime()) && end.getTime() >= start.getTime()
  const starts = `${timetableDayFormat.format(start)}, ${timetableTimeFormat.format(start)}`
  if (!endValid) return starts
  const ends =
    timetableDateKey.format(start) === timetableDateKey.format(end)
      ? timetableTimeFormat.format(end)
      : `${timetableDayFormat.format(end)}, ${timetableTimeFormat.format(end)}`
  return `${starts}–${ends}`
}

function buildMyClassesFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'W zapisanym planie nie widzę zajęć w tym terminie. To nie musi oznaczać wolnego dnia — jeśli coś się nie zgadza, sprawdź import w [Moim planie](/moj-plan).',
    }
  }
  const items = rawItems.slice(0, MAX_CLASSES)
  const remaining = rawItems.length - items.length
  const hasCancellation = items.some((item) =>
    Boolean(pickStringOrNull(item, 'cancelled_announcement_body')),
  )
  const times = items.map((item) => ({
    start: new Date(pickString(item, 'start_time')),
    end: new Date(pickString(item, 'end_time')),
  }))
  const completeSameDay =
    remaining === 0 &&
    pickNumber(result, 'count') === rawItems.length &&
    !hasCancellation &&
    times.every(
      ({ start, end }) =>
        Number.isFinite(start.getTime()) &&
        Number.isFinite(end.getTime()) &&
        end.getTime() >= start.getTime() &&
        timetableDateKey.format(start) ===
          timetableDateKey.format(times[0]!.start) &&
        timetableDateKey.format(end) ===
          timetableDateKey.format(times[0]!.start),
    )
  let daySummary: string | null = null
  if (completeSameDay) {
    const first = new Date(
      Math.min(...times.map(({ start }) => start.getTime())),
    )
    const last = new Date(Math.max(...times.map(({ end }) => end.getTime())))
    const start = timetableTimeFormat.format(first)
    const end = timetableTimeFormat.format(last)
    daySummary =
      items.length === 1
        ? `Według zapisanego planu masz jedne zajęcia, od **${start}** do **${end}**.`
        : `Według zapisanego planu masz ${items.length} ${items.length < 5 ? 'zajęcia' : 'zajęć'}. Zaczynasz o **${start}**, a ostatnie kończą się o **${end}**.`
  }
  const lines = items.map((item) => {
    const summary = factLink(pickString(item, 'summary') || 'zajęcia', null)
    const lecturer = pickStringOrNull(item, 'lecturer_name')
    const location = pickStringOrNull(item, 'location')
    const cancelledBody = pickStringOrNull(item, 'cancelled_announcement_body')
    const when = timetableWhen(
      pickStringOrNull(item, 'start_time'),
      pickStringOrNull(item, 'end_time'),
    )
    const details = [when]
    if (location) details.push(`miejsce: ${factLink(location, null)}`)
    if (lecturer) details.push(`prowadzący: ${factLink(lecturer, null)}`)
    const warning = cancelledBody ? ' · **komunikat o odwołaniu**' : ''
    return `**${summary}** — ${details.join(' · ')}${warning}`
  })
  const lead =
    daySummary ??
    (hasCancellation
      ? 'Zajrzałem do Twojego zapisanego planu. Uwaga: przy części zajęć jest komunikat o odwołaniu — potwierdź, czy dotyczy tego terminu.'
      : lines.length === 1
        ? 'Zajrzałem do Twojego zapisanego planu — w tym terminie widzę jedne zajęcia:'
        : 'Zajrzałem do Twojego zapisanego planu. Tak układają się zajęcia w wybranym terminie:')
  const body =
    lines.length <= 3
      ? lines.join('\n\n')
      : lines.map((line) => `- ${line}`).join('\n')
  const tail =
    remaining > 0
      ? `\n\nPokazuję pierwsze ${items.length} z ${rawItems.length} wpisów. Pozostałe znajdziesz w [Moim planie](/moj-plan).`
      : ''
  return { kind: 'direct', text: `${lead}\n\n${body}${tail}` }
}

// -----------------------------------------------------------------------------
// get_my_weekly_briefing — passthrough (string lub markdown)
// -----------------------------------------------------------------------------

function buildWeeklyBriefingFacts(result: unknown): ToolFactsResult {
  if (typeof result !== 'object' || result === null) {
    return {
      kind: 'direct',
      text: 'Briefingu na ten tydzień jeszcze nie ma — wejdź na zakładkę Briefing, system go policzy.',
    }
  }
  const r = result as Record<string, unknown>
  if (typeof r.markdown === 'string' && r.markdown.length > 0) {
    return { kind: 'direct', text: r.markdown }
  }
  return {
    kind: 'direct',
    text: 'Briefingu na ten tydzień jeszcze nie ma — wejdź na zakładkę Briefing, system go policzy.',
  }
}

// -----------------------------------------------------------------------------
// get_upcoming_usos_registrations
// -----------------------------------------------------------------------------

/** Escape catalog text and allow only web links in tool facts. */
function factLink(label: string, url: string | null): string {
  const title = label.replace(/([\\`*_[\]<>])/g, '\\$1')
  if (!url || !/^https?:\/\//i.test(url)) return title
  return `[${title}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20')})`
}

const registrationDateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Warsaw',
})
function formatRegistrationDate(iso: string | null): string {
  const date = iso ? new Date(iso) : null
  return date && Number.isFinite(date.getTime())
    ? registrationDateFormat.format(date)
    : 'brak potwierdzonej daty'
}

function buildUpcomingUsosFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'W aktualnie pobranych danych nie ma nadchodzących rejestracji. Sprawdź też terminy w USOSweb.',
    }
  }
  const items = rawItems.slice(0, 5)
  const facts = items
    .map((item) => {
      const name = pickString(item, 'title') || 'rejestracja'
      const startsAt = pickStringOrNull(item, 'opens_at')
      const endsAt = pickStringOrNull(item, 'closes_at')
      const opened = startsAt ? Date.parse(startsAt) <= Date.now() : false
      const start = formatRegistrationDate(startsAt)
      const end = endsAt ? formatRegistrationDate(endsAt) : null
      const timing = opened
        ? end
          ? `zapisy trwają do ${end}`
          : `zapisy od ${start}; brak podanego terminu końca`
        : `zapisy od ${start}${end ? ` do ${end}` : ''}`
      const url = pickStringOrNull(item, 'registration_url')
      const title = factLink(name, url)
      const program = pickStringOrNull(item, 'study_program')
      return `${title}${program ? ` (${program})` : ''} — ${timing}`
    })
    .join('\n')
  return catalogueReply(
    facts,
    'Godziny podaję w czasie polskim. Przed zapisami potwierdź termin i zasady w USOSweb.',
    'Trwające i nadchodzące rejestracje USOS.',
  )
}

// -----------------------------------------------------------------------------
// get_upcoming_official_events
// -----------------------------------------------------------------------------

function buildUpcomingOfficialEventsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'W pobranym kalendarzu nie znalazłem nadchodzących wydarzeń. Możesz jeszcze zerknąć do pełnego kalendarza na stronie UJ — źródło mogło się już zmienić.',
    }
  }
  const items = rawItems.slice(0, 5)
  const remaining = rawItems.length - items.length
  const facts = items
    .map((item) => {
      const title = pickString(item, 'title') || 'wydarzenie'
      const startsAt = pickStringOrNull(item, 'date')
      const location = pickStringOrNull(item, 'location')
      const ctx = eventDateContext(startsAt)
      const datePart = startsAt
        ? ctx
          ? `${ctx} (${formatDateShort(startsAt)})`
          : formatDateShort(startsAt)
        : 'bez daty'
      const where = location ? ` w ${location}` : ''
      return `${factLink(title, pickStringOrNull(item, 'event_url'))} — ${datePart}${where}`
    })
    .join('\n')
  return catalogueReply(
    facts,
    remaining > 0
      ? `To część wyników — pozostałe ${remaining} znajdziesz w [wydarzeniach](/wydarzenia).`
      : null,
    'Oficjalne wydarzenia z kalendarza UJ.',
  )
}

// -----------------------------------------------------------------------------
// find_lecturer
// -----------------------------------------------------------------------------

function buildFindLecturerFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nikogo takiego nie mam w bazie. Może literówka?',
    }
  }
  const items = rawItems.slice(0, MAX_LECTURERS)
  const facts = items
    .map((item) => {
      const name = pickString(item, 'lecturer_name') || 'wykładowca'
      const count = pickNumber(item, 'announcement_count') ?? 0
      const latest = pickStringOrNull(item, 'latest_at')
      const countPart =
        count > 0
          ? `${count} ${count === 1 ? 'ogłoszenie' : 'ogłoszeń'}`
          : 'brak ogłoszeń'
      const latestPart = latest
        ? ` (ostatnio ${formatRelativeDate(latest)})`
        : ''
      return `${name} — ${countPart}${latestPart}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint: null,
    topicHint: 'Wyszukiwanie wykładowców UJ po nazwisku w naszej bazie.',
  }
}

// -----------------------------------------------------------------------------
// get_lecturer_announcements_by_name
// -----------------------------------------------------------------------------

function buildLecturerAnnouncementsFacts(result: unknown): ToolFactsResult {
  if (typeof result !== 'object' || result === null) {
    return {
      kind: 'direct',
      text: 'Coś poszło nie tak — spróbuj ponownie.',
    }
  }
  const r = result as Record<string, unknown>
  const lecturer = typeof r.lecturer_name === 'string' ? r.lecturer_name : null
  const items = Array.isArray(r.items) ? r.items : []
  if (items.length === 0) {
    return {
      kind: 'direct',
      text: lecturer
        ? `${lecturer} — nie ma komunikatów w pobranych danych.`
        : 'Brak ogłoszeń.',
    }
  }
  const top = items.slice(0, 5)
  const facts = top
    .map((it) => {
      const status = pickString(it, 'status')
      const statusPl = ANNOUNCEMENT_STATUS_PL[status] ?? status
      const body = pickString(it, 'body')
      const created = pickStringOrNull(it, 'created_at')
      const when = created ? ` (${formatRelativeDate(created)})` : ''
      const tail = body ? `: „${clip(body, 140)}"` : ''
      return `${statusPl}${when}${tail}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint: null,
    topicHint: lecturer
      ? `Ogłoszenia wykładowcy ${lecturer}.`
      : 'Ogłoszenia konkretnego wykładowcy.',
  }
}

// -----------------------------------------------------------------------------
// get_my_followed_lecturers
// -----------------------------------------------------------------------------

function buildMyFollowedLecturersFacts(result: unknown): ToolFactsResult {
  if (typeof result === 'string') return { kind: 'direct', text: result }
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Jeszcze nikogo nie subskrybujesz. Wpadnij w „Mój Plan" i dodaj swoich wykładowców.',
    }
  }
  const items = rawItems.slice(0, 8)
  const facts = items
    .map((it) => {
      const name = pickString(it, 'display_name') || 'wykładowca'
      const recent = pickNumber(it, 'recent_announcement_count') ?? 0
      const latest = pickStringOrNull(it, 'latest_announcement_at')
      const status = pickStringOrNull(it, 'latest_status')
      const statusPl = status
        ? (ANNOUNCEMENT_STATUS_PL[status] ?? status)
        : null
      const recentPart =
        recent > 0
          ? `${recent} ${recent === 1 ? 'ogłoszenie' : 'ogłoszeń'}`
          : 'cisza'
      const latestPart =
        latest && statusPl
          ? ` (ostatnio: ${statusPl}, ${formatRelativeDate(latest)})`
          : ''
      return `${name} — ${recentPart}${latestPart}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint: null,
    topicHint:
      'Subskrybowani wykładowcy usera + status ich najnowszych ogłoszeń.',
  }
}
