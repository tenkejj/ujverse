/**
 * Markdown Guard — ostatnia bramka jakości przed wysłaniem odpowiedzi do usera.
 *
 * Wykrywa scenariusze "wyciekowe", w których finalContent NIE jest poprawnym
 * markdownem dla człowieka, tylko surową strukturą maszyny:
 *
 * 1. **Top-level JSON** — cała treść to obiekt/tablica JSON (np. ktoś
 *    `JSON.stringify`-ował wynik narzędzia i wsadził jako finalContent).
 * 2. **Tool-call leak** — w treści są klucze ze schematu Function Calling
 *    (`"tool_calls"`, `"function_call"`, `"tool_call_id"`, lub
 *    `"function": { ..., "arguments": ... }`). To znaczy że model wypluł
 *    wewnętrzne dane LLM-a zamiast odpowiedzieć po polsku.
 * 3. **Code fence z `json`** — model owinął JSON-a w ```json (zwykle gdy
 *    "myśli na głos" i nie zinterpretował tool-result jako kontekstu).
 *
 * W każdym przypadku zwracamy STAŁY komunikat błędu — lepiej żeby user
 * dostał czytelne "spróbuj ponownie" niż surowy JSON łamiący UI.
 *
 * Defensive design: regexy są zachowawcze. Wolimy fałszywy NEGATYW (puścimy
 * lekko podejrzaną odpowiedź) niż fałszywy POZYTYW (zablokujemy legalną
 * odpowiedź). Stąd np. nie odrzucamy każdego `{` w tekście — tylko gdy
 * cała treść wygląda na bare JSON.
 */

/**
 * Komunikat zwracany do usera, gdy `validateMarkdown` wykryje wyciek
 * surowej struktury. Eksportowany, żeby caller (`api/chat.ts`) mógł rozróżnić
 * "guard zablokował" od "puścił" bez ponownego porównywania stringów —
 * istotne dla logiki cache'u (NIE chcemy cache'ować błędnej odpowiedzi).
 */
export const MARKDOWN_GUARD_ERROR =
  'Wystąpił błąd formatowania odpowiedzi. Ponów zapytanie.'

/**
 * Wzorce ewidentnie wskazujące na wyciek schematu Function Calling
 * (OpenAI / Groq). Te klucze NIE pojawiają się w normalnej polskojęzycznej
 * prozie ani w markdownie, więc ich obecność = pewny error.
 */
const TOOL_CALL_LEAK_PATTERNS: readonly RegExp[] = [
  /"tool_calls"\s*:/i,
  /"function_call"\s*:/i,
  /\btool_call_id\b/,
  // Para function + arguments to wewnętrzny shape tool_call.function
  /"function"\s*:\s*\{[\s\S]{0,200}?"arguments"\s*:/i,
] as const

/**
 * Sprawdza, czy CAŁA treść (po trim) jest bare JSON-em — obiekt lub tablica.
 * Robimy to przez `JSON.parse` (jeśli się uda i typeof === 'object') — daje
 * to zero false-positive'ów (markdown z literalnym `{}` w środku ale resztą
 * tekstu po angielsku/polsku NIE jest poprawnym JSON-em, więc nie zostanie
 * uznane za wyciek).
 *
 * Świadomie restrykcyjne: drobny wycinek JSON-a w środku akapitu NIE zostanie
 * tu wyłapany (do tego są inne reguły). Ta funkcja patrzy tylko czy cała
 * odpowiedź jest "pure JSON".
 */
function isBareJsonStructure(trimmed: string): boolean {
  const first = trimmed.charCodeAt(0)
  const last = trimmed.charCodeAt(trimmed.length - 1)
  // `{` = 123, `}` = 125, `[` = 91, `]` = 93
  const looksObject = first === 123 && last === 125
  const looksArray = first === 91 && last === 93
  if (!looksObject && !looksArray) return false
  try {
    const parsed = JSON.parse(trimmed)
    return parsed !== null && typeof parsed === 'object'
  } catch {
    return false
  }
}

/**
 * Główna funkcja Guard-a. Zwraca:
 * - oryginalną treść, jeśli wygląda na poprawny markdown / tekst,
 * - `MARKDOWN_GUARD_ERROR`, jeśli wykryje wyciek struktury.
 *
 * NIE modyfikuje treści w żadnym innym przypadku (np. nie trymuje, nie
 * normalizuje whitespace) — chcemy zachować dokładnie to, co model
 * wygenerował, gdy odpowiedź jest poprawna. Modyfikacje robi caller.
 */
export function validateMarkdown(content: string): string {
  if (typeof content !== 'string') return MARKDOWN_GUARD_ERROR
  const trimmed = content.trim()
  if (trimmed.length === 0) return MARKDOWN_GUARD_ERROR

  if (isBareJsonStructure(trimmed)) {
    console.warn(
      '[Markdown Guard] blocked: bare JSON structure detected (len:',
      trimmed.length,
      ')',
    )
    return MARKDOWN_GUARD_ERROR
  }

  if (/```json\b/i.test(content)) {
    console.warn('[Markdown Guard] blocked: ```json code fence detected')
    return MARKDOWN_GUARD_ERROR
  }

  for (const pattern of TOOL_CALL_LEAK_PATTERNS) {
    if (pattern.test(content)) {
      console.warn(
        '[Markdown Guard] blocked: tool-call schema leak matched pattern',
        pattern.source,
      )
      return MARKDOWN_GUARD_ERROR
    }
  }

  return content
}
