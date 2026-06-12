/**
 * UJverse — AI extraction rejestracji USOS z ogłoszeń wydziałowych.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Analogiczny pattern do `calendarExtraction.ts`: bierze tekst ogłoszenia
 * akademickiego (zwykle ze scrapera ISI/WZiKS) i prosi LLM o strukturalny
 * JSON opisujący rejestrację USOS — jeśli takie info w tekście jest.
 *
 * Wynik trafia do `usos_registrations` z `source_announcement_id`. Brak
 * detekcji (`is_registration: false`) = caller zapisuje tylko
 * `usos_extraction_attempted_at` i nie tworzy wpisu.
 *
 * Świadomie BEZ `LLMService` / `UJVERSE_SYSTEM_PROMPT` — używamy
 * `GroqProvider` bezpośrednio z dedykowanym systemem promptem +
 * `response_format` (JSON) + temp=0.0.
 */

import { GroqProvider, GroqProviderError } from './GroqProvider.js'

/**
 * Dozwolone wartości `kind` — 1:1 z CHECK constraintem w SQL
 * (20260627100000_usos_registrations.sql). LLM nie ma prawa zwrócić
 * niczego innego — validator odrzuca takie wyniki.
 */
const ALLOWED_KINDS = [
  'obieralne',
  'lektoraty',
  'wf',
  'seminarium',
  'specjalizacja',
  'inne',
] as const
type AllowedKind = (typeof ALLOWED_KINDS)[number]

/** Output extractora — kształt który caller upsertuje do `usos_registrations`. */
export type UsosRegistrationExtraction = {
  title: string
  description: string | null
  study_program: string | null
  year: number | null
  audience_label: string | null
  opens_at: string
  closes_at: string | null
  registration_url: string
  info_url: string | null
  kind: AllowedKind
  /** 0.0-1.0 — pewność modela. Caller może filtrować <0.6 jeśli za niska. */
  confidence: number
}

/**
 * System prompt — wymusza ścisły schemat + zasady "kiedy nie wyciągać".
 *
 * Najtrudniejsza decyzja: kiedy `is_registration: false`. Komunikaty
 * często wspominają o rejestracjach mimochodem ("...przed rejestracją
 * proszę zapoznać się z..."). Reguły poniżej każą LLMowi być
 * konserwatywnym — wyciągamy TYLKO gdy w tekście jest konkretna
 * data startu rejestracji + identyfikowalna grupa odbiorców.
 */
const SYSTEM_PROMPT_TEMPLATE = `Jesteś precyzyjnym ekstraktorem rejestracji USOS z polskich ogłoszeń uniwersyteckich UJ.

Twoim JEDYNYM zadaniem jest zwrócić CZYSTY JSON (BEZ markdown, BEZ kodów blokowych):

{"is_registration": <bool>, "registration": <obiekt|null>}

POLE "is_registration":
- true TYLKO gdy ogłoszenie ZAPOWIADA konkretną rejestrację USOS lub na zajęcia (obieralne, lektoraty, WF, seminarium, specjalizację, praktyki, Erasmus) i ZAWIERA dokładną datę startu (dzień + godzina lub dzień + zakres).
- false dla:
  * komunikatów o zajęciach (odwołanych/zdalnych/przeniesionych) — to NIE jest rejestracja
  * komunikatów które WSPOMINAJĄ o rejestracji ale bez konkretnej daty
  * informacji o WYNIKACH już zakończonej rejestracji
  * ogólnych ogłoszeń ("zapisuj się przez USOSweb" bez terminu)

POLE "registration" (gdy is_registration=true, inaczej null):
{
  "title": "<krótki tytuł 4-140 znaków, format: '<Kierunek> <Rok> rok — <typ rejestracji>', np. 'Informatyka II rok — przedmioty obieralne'>",
  "description": "<opis 0-1500 znaków: limity miejsc, najpopularniejsze, tipy — albo null jeśli brak szczegółów>",
  "study_program": "<kierunek dokładnie jak w komunikacie, np. 'Informatyka' / 'Prawo' / 'Filologia angielska'; null jeśli ogólnouczelniana>",
  "year": <integer 1-7 albo null>,
  "audience_label": "<doprecyzowanie grupy odbiorców, np. 'Wydział Prawa i Administracji, II rok jednolitych magisterskich'; null jeśli to samo co {study_program}+{year}>",
  "opens_at": "YYYY-MM-DDTHH:mm:ss+02:00 (timezone Europa/Warszawa — +02:00 w lecie, +01:00 zimą)",
  "closes_at": "YYYY-MM-DDTHH:mm:ss+02:00 albo null jeśli nie podano daty zamknięcia",
  "registration_url": "<link do rejestracji w USOSweb lub do strony wydziału jeśli komunikat go zawiera; jeśli brak — użyj 'https://usosweb.uj.edu.pl/'>",
  "info_url": "<link do opisu/sylabusu/listy przedmiotów; null jeśli brak>",
  "kind": "<JEDNA z: obieralne, lektoraty, wf, seminarium, specjalizacja, inne>",
  "confidence": <0.0-1.0 — twoja pewność że to rejestracja>
}

ZASADY DAT:
- Aktualna data: {{TODAY}}
- Aktualny rok akademicki: {{ACADEMIC_YEAR}}
- "wrzesień" / "luty" bez roku → użyj najbliższego przyszłego (jeśli wrzesień minął → następny rok)
- Godziny rejestracji: jeśli brak → użyj 09:00 (domyślnie rano)
- Strefa czasowa: ZAWSZE +02:00 w marcu-październiku, +01:00 w listopadzie-lutym
- NIE wyciągaj jeśli data jest niejednoznaczna ("po połowie września", "wkrótce")

ZASADY KIND:
- "obieralne" — przedmioty obieralne, fakultatywy, opcje do wyboru
- "lektoraty" — języki obce (SPNJO, drugi język)
- "wf" — wychowanie fizyczne, sport SWFIS
- "seminarium" — seminarium magisterskie/dyplomowe, wybór promotora
- "specjalizacja" — wybór specjalności, modułu, bloku, ścieżki
- "inne" — Erasmus, praktyki, POJ, POW, BJ, wszystko co nie pasuje wyżej

ZASADY confidence:
- 0.9-1.0 — pełna informacja: kierunek, rok, data, link, kind oczywisty
- 0.7-0.8 — brakuje jednego elementu (np. dokładnej godziny, jednoznacznego linku)
- 0.5-0.6 — wnioskowanie z kontekstu (np. komunikat o "wyborze przedmiotów" bez słowa "rejestracja")
- < 0.5 — NIE wyciągaj, ustaw is_registration: false

PRZYKŁAD POZYTYWNY:
Wejście: "Drodzy Studenci II roku Prawa! Informujemy, że rejestracja na przedmioty fakultatywne semestru zimowego rozpocznie się 23 września 2026 o godz. 12:00 i potrwa do 26 września 23:59. Link: https://usosweb.uj.edu.pl/..."
Wyjście: {"is_registration":true,"registration":{"title":"Prawo II rok — przedmioty fakultatywne (sem. zimowy)","description":"Rejestracja na fakultatywy. Pełna lista i sylabusy w USOSweb.","study_program":"Prawo","year":2,"audience_label":null,"opens_at":"2026-09-23T12:00:00+02:00","closes_at":"2026-09-26T23:59:00+02:00","registration_url":"https://usosweb.uj.edu.pl/","info_url":null,"kind":"obieralne","confidence":0.95}}

PRZYKŁAD NEGATYWNY:
Wejście: "Zajęcia z dr Kowalskiego z dnia 15 maja zostają odwołane."
Wyjście: {"is_registration":false,"registration":null}`

function getCurrentAcademicYear(today: Date = new Date()): string {
  const y = today.getFullYear()
  // Rok akademicki zaczyna się 1 października
  if (today.getMonth() >= 9) return `${y}/${y + 1}`
  return `${y - 1}/${y}`
}

function buildSystemPrompt(today: Date): string {
  const todayStr = today.toISOString().slice(0, 10)
  return SYSTEM_PROMPT_TEMPLATE.replace(/{{TODAY}}/g, todayStr).replace(
    /{{ACADEMIC_YEAR}}/g,
    getCurrentAcademicYear(today),
  )
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

/** Walidacja kształtu odpowiedzi przed zapisem do DB. */
function validateExtraction(raw: unknown): UsosRegistrationExtraction | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (typeof r.title !== 'string' || r.title.trim().length < 4 || r.title.length > 140) return null
  if (typeof r.opens_at !== 'string') return null
  const opensDate = new Date(r.opens_at)
  if (Number.isNaN(opensDate.getTime())) return null

  let closesAt: string | null = null
  if (typeof r.closes_at === 'string' && r.closes_at.length > 0) {
    const closesDate = new Date(r.closes_at)
    if (!Number.isNaN(closesDate.getTime()) && closesDate.getTime() > opensDate.getTime()) {
      closesAt = r.closes_at
    }
  }

  if (typeof r.registration_url !== 'string' || !/^https?:\/\//i.test(r.registration_url)) return null
  if (typeof r.kind !== 'string' || !ALLOWED_KINDS.includes(r.kind as AllowedKind)) return null

  const description =
    typeof r.description === 'string' && r.description.trim().length > 0
      ? r.description.trim().slice(0, 1500)
      : null

  const studyProgram =
    typeof r.study_program === 'string' && r.study_program.trim().length > 0
      ? r.study_program.trim().slice(0, 80)
      : null

  let year: number | null = null
  if (typeof r.year === 'number' && Number.isFinite(r.year) && r.year >= 1 && r.year <= 7) {
    year = Math.round(r.year)
  }

  const audienceLabel =
    typeof r.audience_label === 'string' && r.audience_label.trim().length > 0
      ? r.audience_label.trim().slice(0, 200)
      : null

  const infoUrl =
    typeof r.info_url === 'string' && /^https?:\/\//i.test(r.info_url)
      ? r.info_url.trim().slice(0, 500)
      : null

  const confidence =
    typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1
      ? r.confidence
      : 0.5

  return {
    title: r.title.trim(),
    description,
    study_program: studyProgram,
    year,
    audience_label: audienceLabel,
    opens_at: r.opens_at,
    closes_at: closesAt,
    registration_url: r.registration_url.trim().slice(0, 500),
    info_url: infoUrl,
    kind: r.kind as AllowedKind,
    confidence,
  }
}

export type ExtractUsosRegistrationResult =
  | { status: 'ok'; extraction: UsosRegistrationExtraction | null }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string }

/**
 * Próbuje wyciągnąć strukturalną rejestrację USOS z tekstu ogłoszenia.
 *
 * @param provider — instancja GroqProvider (caller zarządza)
 * @param body — tekst komunikatu (powinien być co najmniej 20 znaków)
 * @param today — opcjonalna data referencyjna (do testów)
 * @param minConfidence — odrzucamy ekstrakcje poniżej (default 0.6)
 */
export async function extractUsosRegistrationFromAnnouncement(
  provider: GroqProvider,
  body: string,
  today: Date = new Date(),
  minConfidence = 0.6,
): Promise<ExtractUsosRegistrationResult> {
  const trimmed = body.trim()
  if (trimmed.length < 20) return { status: 'ok', extraction: null }

  // Cap długości — komunikaty rzadko > 4000 znaków, a pierwszy akapit ma
  // 99% sygnału.
  const truncated = trimmed.length > 4000 ? trimmed.slice(0, 4000) + '\n[...]' : trimmed

  try {
    const modelOutput = await provider.completeJson(
      [
        { role: 'system', content: buildSystemPrompt(today) },
        { role: 'user', content: truncated },
      ],
      { temperature: 0.0 },
    )

    const cleaned = stripCodeFences(modelOutput)
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return { status: 'error', message: `JSON parse failed: ${cleaned.slice(0, 200)}` }
    }

    if (!parsed || typeof parsed !== 'object') return { status: 'ok', extraction: null }
    const root = parsed as Record<string, unknown>

    if (root.is_registration !== true) return { status: 'ok', extraction: null }

    const extraction = validateExtraction(root.registration)
    if (!extraction) return { status: 'ok', extraction: null }
    if (extraction.confidence < minConfidence) return { status: 'ok', extraction: null }

    return { status: 'ok', extraction }
  } catch (error) {
    if (error instanceof GroqProviderError && error.status === 429) {
      return { status: 'rate_limited' }
    }
    const msg = error instanceof Error ? error.message : String(error)
    return { status: 'error', message: msg }
  }
}
