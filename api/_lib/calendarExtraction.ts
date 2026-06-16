/**
 * UJverse — Bielik/Llama ekstrakcja metadanych komunikatu.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Drugi pass scrapera: bierze tekst komunikatu i prosi LLM o strukturalny
 * JSON z DWIEMA rzeczami naraz (jeden roundtrip, jedna kwota Groqa):
 *   1. `summary` — TL;DR po polsku, 1 zdanie ≤ ~200 znaków, ZAWSZE
 *      generowane jeśli komunikat ma treść.
 *   2. `calendar` — strukturalna rama czasowa (kind/starts_at/ends_at/…),
 *      tylko gdy w treści JEST konkretna data/godzina.
 *
 * Summary trafia do `announcements.summary` (osobna kolumna; migracja
 * 20260623100000_announcements_summary.sql). Calendar trafia do
 * `announcements.extracted_calendar` (JSONB), a trigger DB synchronizuje
 * `calendar_entries`.
 *
 * Świadomie BEZ `LLMService` / `UJVERSE_SYSTEM_PROMPT` — analogicznie do
 * normalizatora nazwisk w `scrape-wziks.ts`: tu używamy `GroqProvider`
 * BEZPOŚREDNIO z dedykowanym systemem promptem, niskim temperature i
 * `response_format` (JSON). Trzy persony LLM-a w jednej apce =
 * trzy różne system prompty.
 *
 * Strategia rate-limit:
 *   - `withGroqRetry` (3 próby, exp. backoff) wokół `completeJson` — większość
 *     429 znika bez przerywania całego passu scrapera.
 *   - Po wyczerpaniu retry caller dostaje `rate_limited` i robi krótką pauzę
 *     przed kolejnym rzędem (nie `break` na całym batchu).
 *   - Caller decyduje o throttle (np. max N per cron run, sequential żeby
 *     nie spalić quota Groqa).
 */

import { GroqProvider, GroqProviderError } from './GroqProvider.js'
import { LlmServiceError, withGroqRetry } from './llmService.js'

/**
 * Wartości `kind` jakie BIELIK ma prawo zwrócić. Lista 1:1 z CHECK
 * w SQL trigger `sync_calendar_from_announcement` — wszystko inne
 * (`free_day`, `official_event`, `community_event`, `deadline`)
 * pochodzi z innych sourców i NIE może wyjść z LLM-a.
 */
const ALLOWED_KINDS = [
  'lecturer_absence',
  'class_cancelled',
  'class_remote',
  'class_rescheduled',
  'duty_change',
] as const
type AllowedKind = (typeof ALLOWED_KINDS)[number]

/**
 * Wynik ekstrakcji — surowy JSON jaki trafia do `extracted_calendar`.
 * Trigger DB waliduje to ponownie po stronie SQL (defense in depth).
 *
 * `null` (cały obiekt) = LLM nie wykrył ramki czasowej (legalny komunikat
 * informacyjny bez daty). Wpisujemy `null` do kolumny, ustawiamy
 * `extraction_attempted_at = NOW()` — kolejne uruchomienia scrapera
 * NIE ponawiają próby.
 */
export type CalendarExtraction = {
  kind: AllowedKind
  starts_at: string
  ends_at: string | null
  all_day: boolean
  location: string | null
  confidence: number
}

/**
 * System prompt — wszystkie reguły deterministyczne, żeby Llama-3.1-8b
 * (`FALLBACK_MODEL` w `GroqProvider`) miała szansę utrafić w schemat.
 * Format wymuszamy w prompt'cie + `response_format: json_object` w body
 * — Groq przy 8b modelu poradzi sobie ze ścisłym JSON-em w 90%+.
 *
 * `{{TODAY}}` i `{{ACADEMIC_YEAR}}` rozwijamy w `buildSystemPrompt`.
 */
const SYSTEM_PROMPT_TEMPLATE = `Jesteś precyzyjnym parserem komunikatów akademickich UJ. Wyciągasz dwie rzeczy z polskich komunikatów ISI/WZiKS: krótkie streszczenie i strukturalne dane czasowe.

Twoim JEDYNYM ZADANIEM jest zwrócić CZYSTY JSON o tym kształcie (BEZ markdown, BEZ kodów blokowych):

{"summary":"<jedno zdanie po polsku>","calendar":{"kind":"<wartość>","starts_at":"YYYY-MM-DDTHH:mm:ss","ends_at":"YYYY-MM-DDTHH:mm:ss","all_day":<bool>,"location":<string|null>,"confidence":<0.0-1.0>}}

POLE "summary":
- ZAWSZE jedno zdanie po polsku, MAKS 200 znaków.
- Mówi WPROST CO się dzieje, kogo dotyczy, KIEDY (jeśli wiadomo).
- Bez ozdobników typu „Komunikat informuje, że…", „W komunikacie napisano…". Konkret.
- Dobre: „Dr Kowalski odwołuje wykład z BD we wtorek 18.06."
- Dobre: „Dziekanat nieczynny 24.12; ostatni dzień składania wniosków 23.12."
- Złe: „Komunikat dotyczy zmian w zajęciach." (mglistość)
- Jeśli komunikat jest pusty/bełkotem — summary: null.

POLE "calendar" (lub null jeśli brak konkretnej daty):
- "kind" — JEDNA z wartości:
  - "lecturer_absence" — wykładowca nieobecny, urlop, choroba, „nie będzie w pracy".
  - "class_cancelled" — zajęcia odwołane, „nie odbędą się", anulowane.
  - "class_remote" — zajęcia zdalne, online, MS Teams, Pegaz, asynchronicznie.
  - "class_rescheduled" — zajęcia przeniesione na inny termin, „w zamian", „odpracowanie".
  - "duty_change" — dodatkowy/przesunięty/odwołany dyżur (konsultacje).
- JEŚLI komunikat NIE zawiera konkretnej daty/godziny (lub mówi o czymś abstrakcyjnym typu „w przyszłym semestrze", „od początku roku") → "calendar": null. UWAGA: summary i tak generujesz!

ZASADY DAT (gdy calendar != null):
- Zakres dni („od 15 do 20 czerwca") → starts_at i ends_at na pełne dni, all_day=true.
- Punkt czasowy („wtorek 17.06 o 12:00") → ends_at = starts_at (lub null), all_day=false.
- Cały dzień bez godziny → all_day=true, starts_at = 00:00, ends_at = 23:59 tego dnia.
- Wszystkie daty w strefie Europe/Warsaw, bez offsetu (lokalna). Format ISO 8601 BEZ Z na końcu.
- Aktualna data referencyjna: {{TODAY}}. Aktualny rok akademicki: {{ACADEMIC_YEAR}}.
- „w piątek" / „w przyszłym tygodniu" → wylicz konkretną datę względem {{TODAY}}.
- Jeśli rok nie jest podany, użyj bieżącego z {{TODAY}} (chyba że miesiąc w komunikacie wskazuje miniony — wtedy następny rok).

ZASADY LOKALIZACJI:
- „sala 1.207", „aud. Alpha", „Łojasiewicza 4", „MS Teams", „Pegaz" → tekstem do location.
- Jeśli brak lub niejednoznaczne → location: null.

ZASADY confidence:
- 1.0 = jednoznaczne („wykład odwołany 17.06 o 14:00"),
- 0.7-0.9 = standardowe,
- 0.3-0.6 = niepewne (np. wnioskowanie z kontekstu),
- 0.0 = zwracasz null jako calendar.

ZWRÓĆ TYLKO JSON. NIC INNEGO.`

function getCurrentAcademicYear(today: Date): string {
  // Rok akademicki w PL: od października do września.
  const y = today.getFullYear()
  const month = today.getMonth() // 0-indexed: 0=Jan, 9=Oct
  if (month >= 9) {
    // październik–grudzień → rok akademicki Y/Y+1
    return `${y}/${y + 1}`
  }
  // styczeń–wrzesień → rok akademicki Y-1/Y
  return `${y - 1}/${y}`
}

function buildSystemPrompt(today: Date): string {
  const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD
  return SYSTEM_PROMPT_TEMPLATE.replace(/{{TODAY}}/g, todayStr).replace(
    /{{ACADEMIC_YEAR}}/g,
    getCurrentAcademicYear(today),
  )
}

/** Wycina ```json fence z odpowiedzi modelu (na wszelki wypadek). */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

/** Walidacja kształtu odpowiedzi przed zapisem do DB. */
function validateExtraction(raw: unknown): CalendarExtraction | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (r.kind == null) return null // legalny "nullowy" wynik z modela
  if (typeof r.kind !== 'string') return null
  if (!ALLOWED_KINDS.includes(r.kind as AllowedKind)) return null
  if (typeof r.starts_at !== 'string') return null

  // Walidacja daty (bez wymuszania strefy — DB i tak normalizuje przez timestamptz).
  const startsAtDate = new Date(r.starts_at)
  if (Number.isNaN(startsAtDate.getTime())) return null

  let endsAt: string | null = null
  if (typeof r.ends_at === 'string' && r.ends_at.length > 0) {
    const endsAtDate = new Date(r.ends_at)
    if (!Number.isNaN(endsAtDate.getTime())) {
      endsAt = r.ends_at
    }
  }

  const allDay = typeof r.all_day === 'boolean' ? r.all_day : false
  const location =
    typeof r.location === 'string' && r.location.trim().length > 0
      ? r.location.trim().slice(0, 240)
      : null
  const confidence =
    typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1
      ? r.confidence
      : 0.5

  return {
    kind: r.kind as AllowedKind,
    starts_at: r.starts_at,
    ends_at: endsAt,
    all_day: allDay,
    location,
    confidence,
  }
}

/** Limit długości streszczenia — zgodny z CHECK w SQL (400 z marginesem). */
const SUMMARY_MAX_LENGTH = 280

function validateSummary(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  // Niektóre 8b modele potrafią zwrócić „null" jako string — odsiewamy.
  if (trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null
  }
  return trimmed.length > SUMMARY_MAX_LENGTH ? trimmed.slice(0, SUMMARY_MAX_LENGTH).trim() : trimmed
}

/**
 * Wynik wywołania extractora — rozróżnia tryb „nie udało się wywołać"
 * (caller NIE powinien zapisywać `extraction_attempted_at`, żeby kolejny
 * cron spróbował ponownie) od „LLM zwrócił legalnie null" (caller
 * zapisuje attempted + extraction=null).
 *
 * Status `ok` zawiera OBA pola opcjonalnie — np. komunikat o uruchomieniu
 * stypendium ma sensowne summary, ale brak konkretnej daty (extraction=null).
 */
export type ExtractAnnouncementMetadataResult =
  | { status: 'ok'; summary: string | null; extraction: CalendarExtraction | null }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string }

/**
 * Legacy alias zachowany dla kompatybilności wstecznej z importerami,
 * które jeszcze nie zaktualizowano do nowego API. Nowy kod powinien
 * używać `ExtractAnnouncementMetadataResult` i `extractAnnouncementMetadata`.
 */
export type ExtractCalendarResult = ExtractAnnouncementMetadataResult

export async function extractAnnouncementMetadata(
  provider: GroqProvider,
  body: string,
  today: Date = new Date(),
): Promise<ExtractAnnouncementMetadataResult> {
  const trimmed = body.trim()
  if (trimmed.length < 20) {
    // Za krótki tekst → ani summary, ani kalendarz. Caller zapisze
    // extraction_attempted_at i pójdzie dalej (no_temporal_data flow).
    return { status: 'ok', summary: null, extraction: null }
  }

  // Capujemy długość żeby nie eksplodować promptu (Llama-3.1-8b ma okno 128k,
  // ale rozsądnie do 4000 znaków — komunikaty rzadko dłuższe, a ekstrakcja
  // korzysta głównie z pierwszego akapitu).
  const truncated = trimmed.length > 4000 ? trimmed.slice(0, 4000) + '\n[...]' : trimmed

  try {
    const modelOutput = await withGroqRetry(() =>
      provider.completeJson(
        [
          { role: 'system', content: buildSystemPrompt(today) },
          { role: 'user', content: truncated },
        ],
        { temperature: 0.0 },
      ),
    )

    const cleaned = stripCodeFences(modelOutput)
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return {
        status: 'error',
        message: `JSON parse failed: ${cleaned.slice(0, 200)}`,
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { status: 'ok', summary: null, extraction: null }
    }
    const root = parsed as Record<string, unknown>

    // Backward-compat: starszy schemat zwracał flat objekt z kind/starts_at
    // bezpośrednio w roocie (bez wrapowania w `calendar`). Jeśli widzimy
    // takie pola → traktujemy je jako calendar i nie szukamy summary.
    const calendarRaw =
      root.calendar !== undefined
        ? root.calendar
        : 'kind' in root || 'starts_at' in root
          ? root
          : null

    const summary = validateSummary(root.summary)
    const extraction = validateExtraction(calendarRaw)

    return { status: 'ok', summary, extraction }
  } catch (error) {
    const groqStatus =
      error instanceof GroqProviderError
        ? error.status
        : error instanceof LlmServiceError && error.cause instanceof GroqProviderError
          ? error.cause.status
          : null
    if (groqStatus === 429) {
      return { status: 'rate_limited' }
    }
    const msg = error instanceof Error ? error.message : String(error)
    return { status: 'error', message: msg }
  }
}

/**
 * Legacy entrypoint — deleguje do `extractAnnouncementMetadata` i ignoruje
 * summary. Nowy kod (scrape-wziks.ts po PR #8c) używa metadata bezpośrednio.
 */
export async function extractCalendarFromAnnouncement(
  provider: GroqProvider,
  body: string,
  today: Date = new Date(),
): Promise<ExtractAnnouncementMetadataResult> {
  return extractAnnouncementMetadata(provider, body, today)
}
