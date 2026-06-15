/**
 * Synthesizer — naturalna odpowiedź dla użytkownika z surowych wyników toola.
 *
 * Filozofia: SERWER NIE PISZE odpowiedzi. Serwer wyciąga z wyników faktów
 * (compact bullet-string) i prosi tani model (Llama 8B) o ułożenie ich
 * w naturalne, krótkie zdanie odpowiadające konkretnie na pytanie usera.
 *
 * Po co: wcześniej mieliśmy hardcoded leady typu „Spoko, 2 rzeczy:" które
 * były podejrzane (nie pasują do pytania) i sztywne (zero wariancji).
 * LLM dostając pytanie + fakty potrafi po prostu napisać po ludzku.
 *
 * Tradeoff: dodajemy ~1 dodatkowy round-trip do Groqa per tool (Llama 8B,
 * tani i szybki — ~150ms TTFB, ~$0.0001 per request). Przy 60s response
 * cache to dla typowych zapytań ~5-10× rzadsze niż 1:1.
 *
 * Nieużywany dla:
 *  - empty results (gotowy fallback string)
 *  - błędów (gotowy fallback string)
 *  - passthrough toolów (briefing — już jest mardownem)
 */

import {
  GroqProvider,
  type GroqStreamChunk,
  type GroqUsage,
} from './GroqProvider.js'
import { GROQ_SMALLTALK_MODEL, withGroqRetry } from './llmService.js'
import type { GroqMessage } from './types.js'

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Wynik `buildToolFacts`. Albo gotowa odpowiedź ('direct' — empty/error/
 * passthrough), albo fakty do syntezy ('synthesize' — Llama 8B robi resztę).
 */
export type ToolFactsResult =
  | { kind: 'direct'; text: string }
  | {
      kind: 'synthesize'
      /** Compact, deterministic bullet list (1 fakt = 1 linia). */
      facts: string
      /** Krótka wskazówka „gdzie zobaczyć więcej" — opcjonalna. */
      hint: string | null
      /** Krótkie one-liner co ten tool sprawdza, dla syntezatora kontekstu. */
      topicHint: string
    }

// =============================================================================
// SYSTEM PROMPT — strict persona dla syntezy
// =============================================================================

/**
 * System prompt dla Llama 8B robiącego syntezę. NIE jest to lista zakazów —
 * to charakter postaci. Model dostaje go każdym wywołaniem, więc każdy
 * zbędny token = koszt, ale ten budżet wolimy wydać na osobowość niż na
 * regulamin.
 *
 * Filozofia:
 *  - DAJEMY charakter (krakus-student, zna miasto i UJ, gada luźno) zamiast
 *    listy "bez tego, bez tamtego" — model wybiera bezpieczny suchy ton gdy
 *    nie wie kim ma być.
 *  - DAJEMY 3 przykłady "tak ma brzmieć" — few-shot learning > regulamin.
 *  - POZWALAMY na krótki komentarz / reakcję — żeby brzmiał jak rozmowa,
 *    nie jak spiker faktów.
 *  - NIE narzucamy sztywnego limitu zdań — niech model sam wyczuje co pasuje.
 */
const SYNTHESIS_SYSTEM_PROMPT = `Jesteś krakowskim asystentem UJverse — gadasz jak znajomy student z UJ co dobrze zna miasto. Luźno, na ty, czasem z dystansem albo lekką ironią. Reagujesz na to co znalazłeś — gdy oferta dobra, możesz krótko skomentować ("całkiem nieźle", "blisko centrum", "akurat dziś"), gdy słaba, przyznasz to.

Pisz prozą, jak w czacie ze znajomym. Bez bulletów, bez nagłówków, bez fraz typu "spoko, X rzeczy", "mam dla Ciebie X". Możesz pogrubić nazwy lokali / wykładowców gdy ich kilka. Używaj TYLKO podanych faktów — nigdy nic nie zmyślaj.

Echo'uj temat pytania (user pyta o pizzę → odpowiedz o pizzy, nie o "miejscach"). Długość naturalna — krótko gdy 1-2 wyniki, więcej gdy potrzeba je rozróżnić.

Przykłady jak ma to brzmieć:

User: "gdzie zjem pizze taniej"
Fakty: Pizza Hut Galeria Kazimierz — -15% na lunch 12-15. Pizza Manzana ul. Kazimierza Wielkiego — -10% z legitymacją na wynos.
Ty: "Pizzy taniej? **Pizza Hut** w Galerii Kazimierz daje -15% na lunch 12-15 — całkiem przyzwoicie jak chcesz coś szybkiego między zajęciami. Albo **Pizza Manzana** z Kazimierza Wielkiego — -10% z legitymacją, ale tylko na wynos."

User: "co dziś na feedzie"
Fakty: @kasia (2h temu) — "ktoś idzie dziś na koncert do Hevre?"
Ty: "Niewiele dziś — **@kasia** dwie godziny temu pytała czy ktoś leci wieczorem do Hevre na koncert. Jak interesuje Cię taki klimat, można się dopisać."

User: "pokaż zniżki na kawę"
Fakty: (brak)
Ty: "Akurat na kawę nic mi w bazie nie świeci. Sprawdź zakładkę Zniżki — czasem coś tam dorzucają."`

// =============================================================================
// SYNTHESIS CALL
// =============================================================================

export type SynthesisOptions = {
  userQuery: string
  facts: string
  hint: string | null
  topicHint: string
  provider: GroqProvider
  /**
   * Anti-repetition: lista 1-3 pierwszych słów ostatnich odpowiedzi
   * Versusia w tej rozmowie. Jeśli przekazana, dorzucamy do prompta
   * negatywną wskazówkę („NIE zaczynaj od ..."). Llama 8B respektuje takie
   * constrainty i wybiera inny opener — eliminuje monotonny rytm typu
   * „Spoko, sprawdziłem..." × 5 turę pod rząd.
   *
   * Format: surowe pierwsze słowa (`['Spoko, sprawdziłem', 'No więc']`).
   * Empty / undefined → bez constraintu.
   */
  recentOpeners?: readonly string[]
}

export type SynthesisResult = {
  text: string
  usage: GroqUsage | null
}

/**
 * Wykonuje wywołanie Groq Llama 8B z faktami i pytaniem. Non-streaming
 * (`completeWithTools` z pustą tablicą tooli zachowuje się jak chat completion).
 *
 * Failure mode: gdy Groq odpowie pustym/blankowym contentem, fallback
 * do `facts.fallbackText` (caller musi przekazać). To rzadkie ale chroni
 * UX — lepiej zwrócić surowe fakty niż "" do klienta.
 */
export async function synthesizeAnswer(
  opts: SynthesisOptions,
): Promise<SynthesisResult> {
  const { userQuery, facts, hint, topicHint, provider, recentOpeners } = opts

  // Compose user message: kontekst + pytanie + fakty + ewentualna wskazówka.
  // Format zwięzły (LLM-friendly), nie ozdobny — model nie ma tego echo'wać.
  const userParts: string[] = [
    `Pytanie usera: ${userQuery}`,
    `Kontekst: ${topicHint}`,
    'Fakty (każda linia = jeden wynik):',
    facts,
  ]
  if (hint) {
    userParts.push(`Wskazówka na koniec (opcjonalna): ${hint}`)
  }
  // Anti-repetition guard: jeśli mamy 1-3 ostatnich openerów Versusia,
  // wstrzykujemy negatywną instrukcję. Model widzi „NIE zaczynaj od X" i
  // wybiera inny lead. Ważne: trzymamy się 1 zdania, krótko — to czyste
  // antypowtórzenie, nie wykład.
  if (recentOpeners && recentOpeners.length > 0) {
    const quoted = recentOpeners
      .slice(0, 3)
      .map((o) => `"${o}"`)
      .join(', ')
    userParts.push(
      `Nie zaczynaj odpowiedzi od: ${quoted} — wybierz inny lead, żeby brzmiało świeżo.`,
    )
  }
  userParts.push('Odpowiedz po polsku, krótko, naturalnie.')

  const messages: GroqMessage[] = [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ]

  // `withGroqRetry`: 3 próby z exp. backoff dla 429/5xx. Llama 8B free tier
  // = 30 RPM — szybki burst zapytań od jednego usera potrafi wpaść w 429,
  // a tutaj jesteśmy już PO tool call, więc fallback na surowe fakty
  // wyglądałby topornie. Cichy retry ratuje doświadczenie.
  const result = await withGroqRetry(() =>
    provider.completeWithTools(messages, [], {
      model: GROQ_SMALLTALK_MODEL,
      // Budżet z zapasem — z luźną personą model dodaje komentarze
      // („całkiem przyzwoicie", „akurat blisko centrum") i przy 5+ wynikach
      // potrzebuje miejsca na wszystkie + krótkie reakcje. 400 tok = ~8 zdań
      // PL z luzem, eliminuje cięcia w pół słowa typu „bez zbędnego kopi[owania]".
      maxTokens: 400,
      // Wyższa temperatura → mniej powtarzalne formy, więcej naturalnych
      // wariacji ("Pizzy taniej?" vs "Pod pizzę masz parę miejsc" vs „Tanio
      // na pizzę: ..."). 0.75 to sweet spot dla Llama 8B w PL — niżej brzmi
      // robotycznie, wyżej zaczyna kombinować ze słownictwem.
      temperature: 0.75,
      toolChoice: 'none',
    }),
  )

  const content =
    typeof result.message.content === 'string'
      ? result.message.content.trim()
      : ''

  return {
    text: content,
    usage: result.usage,
  }
}

/**
 * Streaming wariant `synthesizeAnswer` — emituje delty Llama 8B w locie,
 * zamiast czekać na cały tekst. Caller (orchestrator w `api/chat.ts`)
 * konsumuje delty SSE i przepisuje je w swoim formacie do klienta —
 * **pierwsze tokeny widoczne u usera ~200-400ms zamiast ~1500ms TTFB**.
 *
 * Zwraca AsyncGenerator `GroqStreamChunk` (delta / done / error). Caller
 * powinien buforować całość do KV cache + markdown guard po `done`.
 *
 * NIE używamy `withGroqRetry` w streamie — retry SSE jest skomplikowany
 * (już mogliśmy wysłać delty do klienta). Caller decyduje o fallbacku:
 * przy wyjątku z `streamAnswer` wraca do non-streaming `synthesizeAnswer`
 * i robi normalny chunked fallback.
 */
export async function* streamAnswer(
  opts: SynthesisOptions,
): AsyncGenerator<GroqStreamChunk, void, void> {
  const { userQuery, facts, hint, topicHint, provider, recentOpeners } = opts

  const userParts: string[] = [
    `Pytanie usera: ${userQuery}`,
    `Kontekst: ${topicHint}`,
    'Fakty (każda linia = jeden wynik):',
    facts,
  ]
  if (hint) {
    userParts.push(`Wskazówka na koniec (opcjonalna): ${hint}`)
  }
  if (recentOpeners && recentOpeners.length > 0) {
    const quoted = recentOpeners
      .slice(0, 3)
      .map((o) => `"${o}"`)
      .join(', ')
    userParts.push(
      `Nie zaczynaj odpowiedzi od: ${quoted} — wybierz inny lead, żeby brzmiało świeżo.`,
    )
  }
  userParts.push('Odpowiedz po polsku, krótko, naturalnie.')

  const messages: GroqMessage[] = [
    { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ]

  yield* provider.streamCompletion(messages, [], {
    model: GROQ_SMALLTALK_MODEL,
    maxTokens: 400,
    temperature: 0.75,
    toolChoice: 'none',
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
      const catLabel = category ? DISCOUNT_CATEGORY_PL[category] ?? category : null
      // Niektóre adresy mają już własne nawiasy ("ul. X (Galeria Y)"). Zamiast
      // owijać kolejną parą, użyj „, " jako separatora — czystsze dla LLM.
      const where = address ? address.replace(', Kraków', '') : null
      const parts: string[] = [business]
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
    topicHint: 'Zniżki studenckie w Krakowie z bazy UJverse.',
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
      const usesPart = recentUses > 0 ? ` (${recentUses}× w tym tygodniu)` : ''
      return `${business} — ${headline}${usesPart}`
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
      return `${title}${tag} — ${datePart}${where}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint:
      remaining > 0
        ? `jeszcze ${remaining} w bazie, zerknij na zakładkę Wydarzenia`
        : null,
    topicHint: 'Wydarzenia akademickie i studenckie w Krakowie.',
  }
}

// -----------------------------------------------------------------------------
// get_latest_announcements
// -----------------------------------------------------------------------------

function buildAnnouncementsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Cisza, ostatnio nic nowego z ISI UJ nie wpadło.',
    }
  }
  const items = rawItems.slice(0, MAX_ANNOUNCEMENTS)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
      const lecturer =
        pickString(item, 'lecturer_name_nominative') || 'ktoś z kadry'
      const statusKey = pickString(item, 'status')
      const statusPl = ANNOUNCEMENT_STATUS_PL[statusKey] ?? statusKey
      const body = pickString(item, 'body')
      const dept = pickStringOrNull(item, 'department')
      const createdAt = pickStringOrNull(item, 'created_at')

      const when = createdAt ? ` (${formatRelativeDate(createdAt)})` : ''
      const deptTag = dept ? ` [${dept}]` : ''
      const tail = body ? ` — ${clip(body, 160)}` : ''
      return `${lecturer} ${statusPl}${when}${deptTag}${tail}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint: remaining > 0 ? `jeszcze ${remaining} dalej` : null,
    topicHint: 'Komunikaty wykładowców UJ (nieobecności, zmiany sal itd.).',
  }
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
      text: 'Nic mi się nie pasuje do tego zapytania w bazie ogłoszeń.',
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
      return `@${username}${when} —${quote}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint: remaining > 0 ? `jeszcze parę wpisów na feedzie` : null,
    topicHint: 'Wpisy z feeda UJverse (społeczność).',
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
      remaining > 0
        ? `jeszcze ${remaining} dalej, zerknij na Kalendarz`
        : null,
    topicHint: 'Kalendarz UJverse (nieobecności, odwołania, deadliny, eventy).',
  }
}

// -----------------------------------------------------------------------------
// get_my_classes_in_range
// -----------------------------------------------------------------------------

function buildMyClassesFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Wolne, nic nie masz w planie. Jeśli to błąd — wpadnij na „Mój Plan" i odśwież import z USOSweb.',
    }
  }
  const items = rawItems.slice(0, MAX_CLASSES)
  const remaining = rawItems.length - items.length

  const facts = items
    .map((item) => {
      const summary = pickString(item, 'summary') || 'zajęcia'
      const start = pickStringOrNull(item, 'start_time')
      const lecturer = pickStringOrNull(item, 'lecturer_name')
      const location = pickStringOrNull(item, 'location')
      const cancelledBody = pickStringOrNull(
        item,
        'cancelled_announcement_body',
      )

      const ctx = eventDateContext(start)
      const datePart = start
        ? ctx
          ? `${ctx} (${formatDateShort(start)})`
          : formatDateShort(start)
        : 'bez daty'
      const lec = lecturer ? `, ${lecturer}` : ''
      const sala = location ? ` — sala ${location}` : ''
      const cancelTag = cancelledBody ? ' [ODWOŁANE]' : ''
      return `${summary}${cancelTag} ${datePart}${lec}${sala}`
    })
    .join('\n')

  return {
    kind: 'synthesize',
    facts,
    hint: remaining > 0 ? `jeszcze ${remaining} dalej` : null,
    topicHint: 'Plan zajęć usera (z USOSweb, z naszymi powiadomieniami o odwołaniach).',
  }
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

function buildUpcomingUsosFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'Nic w najbliższych tygodniach — najbliższe rejestracje USOS jeszcze nie są ogłoszone.',
    }
  }
  const items = rawItems.slice(0, 5)
  const facts = items
    .map((item) => {
      const name = pickString(item, 'name') || 'rejestracja'
      const startsAt = pickStringOrNull(item, 'starts_at')
      const endsAt = pickStringOrNull(item, 'ends_at')
      const ctx = eventDateContext(startsAt)
      const start = startsAt
        ? ctx
          ? `${ctx} (${formatDateShort(startsAt)})`
          : formatDateShort(startsAt)
        : 'bez daty'
      const end = endsAt ? ` do ${formatDateShort(endsAt)}` : ''
      return `${name} — start ${start}${end}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint: 'więcej szczegółów w USOSweb',
    topicHint: 'Najbliższe rejestracje USOS (na zajęcia, egzaminy itd.).',
  }
}

// -----------------------------------------------------------------------------
// get_upcoming_official_events
// -----------------------------------------------------------------------------

function buildUpcomingOfficialEventsFacts(result: unknown): ToolFactsResult {
  const rawItems = getItemsArray(result)
  if (!rawItems || rawItems.length === 0) {
    return {
      kind: 'direct',
      text: 'W oficjalnym kalendarzu UJ na razie cisza.',
    }
  }
  const items = rawItems.slice(0, 5)
  const remaining = rawItems.length - items.length
  const facts = items
    .map((item) => {
      const title = pickString(item, 'title') || 'wydarzenie'
      const startsAt = pickStringOrNull(item, 'starts_at')
      const location = pickStringOrNull(item, 'location')
      const ctx = eventDateContext(startsAt)
      const datePart = startsAt
        ? ctx
          ? `${ctx} (${formatDateShort(startsAt)})`
          : formatDateShort(startsAt)
        : 'bez daty'
      const where = location ? ` w ${location}` : ''
      return `${title} — ${datePart}${where}`
    })
    .join('\n')
  return {
    kind: 'synthesize',
    facts,
    hint:
      remaining > 0
        ? `jeszcze ${remaining} dalej, zerknij na Kalendarz UJ`
        : null,
    topicHint: 'Oficjalne wydarzenia z kalendarza UJ.',
  }
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
        ? `${lecturer} — w bazie znaleziony, ale brak ogłoszeń. Spokojny wykładowca.`
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
        ? ANNOUNCEMENT_STATUS_PL[status] ?? status
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
