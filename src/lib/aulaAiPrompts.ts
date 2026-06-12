/**
 * UJverse — aulaAiPrompts: persona + zestaw promptów dla AI w module Aula.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Mirror po stronie serwera: `api/aula-ai.ts` używa tych samych promptów
 * (zaimportuje przez relative path z `../src/lib/aulaAiPrompts.ts`). Trzymanie
 * tych stringów w jednym miejscu ułatwia synchronizację UI labelek z tekstami,
 * które model widzi (np. „Streszczenie" w UI ↔ kontrakt persona).
 *
 * Tasks (publiczny enum):
 *   - 'summarize_channel'  — bullet list z key-points ostatnich N wiadomości
 *   - 'explain_message'    — wyjaśnij prościej, jakbyś tłumaczył znajomemu
 *   - 'simplify_message'   — streszczenie do 2 zdań
 *   - 'translate_message'  — przetłumacz na język (default: en)
 *
 * Limity:
 *   - max 30 wiadomości w kontekście summarize (RPM + cost discipline)
 *   - max 4000 znaków per single message (truncate w kliencie przed wysłaniem)
 *   - response cap ~500 tokenów (`max_tokens` w request)
 */

export type AulaAiTask =
  | 'summarize_channel'
  | 'explain_message'
  | 'simplify_message'
  | 'translate_message'

/**
 * Persona — wspólna dla wszystkich AI tasków w Auli. Świadomie krótka i
 * task-agnostic; per-task system prompt dopina szczegóły (output format,
 * długość, ton).
 */
export const AULA_AI_PERSONA = `Jesteś asystentem AI dla UJverse Aula — modułu czatu dla studentów Uniwersytetu Jagiellońskiego. Pomagasz z notatkami, wyjaśnieniami i streszczeniami. Odpowiadasz po polsku, krótko i konkretnie. Bez gadania o sobie. Bez "Oczywiście, oto..." na początku. Bezpośrednio do rzeczy.`

/** Twarde limity wspólne dla wszystkich tasków. */
export const AULA_AI_LIMITS = {
  MAX_CONTEXT_MESSAGES: 30,
  MAX_CHARS_PER_MESSAGE: 4000,
  MAX_CHARS_SINGLE_TEXT: 6000,
  MAX_OUTPUT_TOKENS: 500,
} as const

export type SummarizeChannelInput = {
  channelName: string
  channelKindLabel: string | null
  messages: Array<{ authorName: string; content: string; timestamp: string }>
}

export type ExplainOrSimplifyInput = {
  text: string
  channelName?: string
}

export type TranslateInput = {
  text: string
  targetLang?: 'en' | 'de' | 'es' | 'fr' | 'uk'
}

/** Compose system + user prompt dla summarize. Server consumer. */
export function buildSummarizeMessages(input: SummarizeChannelInput): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const channelLabel = input.channelKindLabel
    ? `${input.channelKindLabel} — ${input.channelName}`
    : input.channelName

  const transcript = input.messages
    .slice(-AULA_AI_LIMITS.MAX_CONTEXT_MESSAGES)
    .map(
      (m) =>
        `[${new Date(m.timestamp).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}] ${m.authorName}: ${m.content.slice(0, AULA_AI_LIMITS.MAX_CHARS_PER_MESSAGE)}`,
    )
    .join('\n')

  const system = `${AULA_AI_PERSONA}

Zadanie: streszczenie sali "${channelLabel}". Pokaż bullety z najważniejszymi rzeczami które tam się działy w widocznych wiadomościach.

Format wyjścia (markdown):
- 3–6 bulletów, każdy 1 linia
- każda linia zaczyna się od konkretu (kto/co/kiedy), bez "User napisał że..."
- na końcu sekcja "**Otwarte wątki:**" jeśli są nierozstrzygnięte pytania (max 2)

Zasady:
- ignoruj „elo", „xd", spam, off-topic
- nie cytuj wiadomości dosłownie — synthesize
- gdy <3 sensownych wiadomości: odpowiedz "Brak wystarczającego kontekstu do streszczenia."`

  const user = `Wiadomości (chronologicznie, najnowsze na dole):\n\n${transcript || '(brak wiadomości)'}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Compose dla explain (wyjaśnij prościej). */
export function buildExplainMessages(input: ExplainOrSimplifyInput): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const system = `${AULA_AI_PERSONA}

Zadanie: wyjaśnij tekst prościej, jakbyś tłumaczył znajomemu który nie zna kontekstu. Rozszyfruj skróty, terminy, żargon UJ. Wskaż co jest najważniejsze.

Format:
- jeden krótki paragraf (3–5 zdań) ALBO
- 2–4 bullety jeśli treść ma kilka osobnych punktów

Nie powtarzaj tekstu dosłownie. Nie dodawaj „W skrócie:" — od razu do meritum.`

  const trimmed = input.text.slice(0, AULA_AI_LIMITS.MAX_CHARS_SINGLE_TEXT)
  const user = input.channelName
    ? `Sala: "${input.channelName}"\n\nTekst do wyjaśnienia:\n"""\n${trimmed}\n"""`
    : `Tekst do wyjaśnienia:\n"""\n${trimmed}\n"""`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Compose dla simplify (streszczenie do 2 zdań). */
export function buildSimplifyMessages(input: ExplainOrSimplifyInput): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const system = `${AULA_AI_PERSONA}

Zadanie: streszczenie tekstu do MAKSYMALNIE 2 zdań. Tylko najważniejsze. Bez wstępu „Tekst mówi że...". Po prostu fakty.`

  const trimmed = input.text.slice(0, AULA_AI_LIMITS.MAX_CHARS_SINGLE_TEXT)
  const user = `Tekst do streszczenia:\n"""\n${trimmed}\n"""`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Compose dla translate (default EN). */
export function buildTranslateMessages(input: TranslateInput): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const lang = input.targetLang ?? 'en'
  const langName = {
    en: 'angielski',
    de: 'niemiecki',
    es: 'hiszpański',
    fr: 'francuski',
    uk: 'ukraiński',
  }[lang]

  const system = `${AULA_AI_PERSONA}

Zadanie: przetłumacz tekst na ${langName}. Zachowaj ton i strukturę (jeśli były bullety — niech zostaną bullety). Zwróć TYLKO tłumaczenie, bez „Translation:" / „Tłumaczenie:" itp.`

  const trimmed = input.text.slice(0, AULA_AI_LIMITS.MAX_CHARS_SINGLE_TEXT)
  const user = trimmed

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * Routing po `task` → builder. Server dispatch tu woła `buildMessages(task, payload)`.
 * Walidacja `payload` zostaje po stronie servera (tu zakładamy że wszystko OK).
 */
export type AulaAiPayload =
  | { task: 'summarize_channel'; input: SummarizeChannelInput }
  | { task: 'explain_message'; input: ExplainOrSimplifyInput }
  | { task: 'simplify_message'; input: ExplainOrSimplifyInput }
  | { task: 'translate_message'; input: TranslateInput }

export function buildMessagesForTask(payload: AulaAiPayload): Array<{
  role: 'system' | 'user'
  content: string
}> {
  switch (payload.task) {
    case 'summarize_channel':
      return buildSummarizeMessages(payload.input)
    case 'explain_message':
      return buildExplainMessages(payload.input)
    case 'simplify_message':
      return buildSimplifyMessages(payload.input)
    case 'translate_message':
      return buildTranslateMessages(payload.input)
  }
}
