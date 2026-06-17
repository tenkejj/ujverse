/**
 * Smart Contextual Chips — generowane LLM-em na bazie pelnej odpowiedzi.
 *
 * Filozofia: statyczne chipy (`followUpChips.ts`) sa generic per-tool i
 * dzialaja w 80% przypadkow. Smart chips znaja KONKRETNA odpowiedz i
 * proponuja prawdziwie pasujace next-stepy:
 *
 *   Static:  "Tylko jedzenie" / "Blizej Rynku" / "Pokaz wiecej"
 *   Smart:   "Tylko Pizza Hut" / "Z deliveru?" / "Co po 22?"
 *
 * Wywolywany RoOWNOLEGLE z syntezatorem — startuje gdy mamy fakty i
 * pytanie usera, kanczy sie kiedy klient juz dawno widzi odpowiedz.
 * Drugi meta-event emitowany na samym koncu strumienia (po `[DONE]`
 * syntezy, przed `[DONE]` SSE) nadpisuje statyczne chipy nowymi.
 *
 * Tradeoff vs static:
 *  - +1 Llama 8B call (~150ms, ~$0.0001/per) - swiadomy koszt
 *  - +800ms timeout race - jak nie zdazy, klient ma statyczne (graceful)
 *  - Wymaga JSON output - Llama 8B czasem rzuca tekstem zamiast JSONa;
 *    parser tolerancyjny, blad -> empty -> statyczne chipy zostaja
 *
 * Polityka chipow:
 *  - Max 3 chipy, kazdy max 24 znaki (dluzsze nie miesce sie na mobile)
 *  - Po polsku, krotkie, akcjowe (czasownik / pytanie)
 *  - Brak emoji, brak punktow
 *  - Imperatyw / pytanie ("Pokaz wiecej" / "Co jutro?")
 */

import {
  GroqProvider,
  type GroqUsage,
} from './GroqProvider.js'
import { GROQ_SMALLTALK_MODEL, withGroqRetry } from './llmService.js'
import type { GroqMessage } from './types.js'

/**
 * Smart chips domyślnie WYŁĄCZONE — statyczne chipy (`followUpChips.ts`)
 * wystarczają i kosztują 0 tok. Włącz `VERSUS_SMART_CHIPS=1` gdy masz
 * budżet na dodatkowy call Llama 8B per odpowiedź narzędziowa.
 */
export function isSmartChipsEnabled(): boolean {
  const v = process.env.VERSUS_SMART_CHIPS?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const SMART_CHIPS_SYSTEM_PROMPT = `Jesteś generatorem follow-up chipów dla czatu studenckiego. Dostajesz pytanie usera + odpowiedź Versusia. Twoja praca: zaproponuj 2-3 KRÓTKIE klikalne sugestie do czego user może dalej zapytać.

Reguły:
- ZWROC TYLKO JSON: {"chips": ["tekst", "tekst", "tekst"]}
- Max 3 chipy. Max 24 znaki każdy.
- Po polsku, krótko, akcjowo (czasownik / pytanie).
- Bez emoji, bez kropek na końcu, bez bulletów.
- Konkretne dla TEJ odpowiedzi (nie generic "Pokaż więcej").
- Nie powtarzaj treści odpowiedzi - sugeruj NASTĘPNY krok.

Przykłady:
- Odpowiedź o zniżkach Pizza Hut + Pizza Manzana → ["Tylko Pizza Hut", "Z dowozem?", "Bez umowy?"]
- Odpowiedź o zajęciach na jutro → ["Sala pierwszego?", "Co po przerwie?", "Mam egzaminy?"]
- Odpowiedź o ogłoszeniu z ankietą → ["Jak długo aktywna?", "Inne ogłoszenia"]`

export type SmartChipsOptions = {
  userQuery: string
  fullAnswer: string
  toolName: string | null
  provider: GroqProvider
  /**
   * Hard timeout w ms — po przekroczeniu zwracamy `null` (bez nadpisania
   * statycznych chipow). Default 800ms — Llama 8B zwykle laduje w 300-500ms,
   * 800ms zostawia bufor na 5xx retry, ale nie blokuje SSE [DONE] zbyt
   * dlugo.
   */
  timeoutMs?: number
}

export type SmartChipsResult = {
  chips: string[]
  usage: GroqUsage | null
} | null

const DEFAULT_TIMEOUT_MS = 800
const MAX_CHIPS = 3
const MAX_CHIP_LENGTH = 24

/**
 * Tolerancyjny JSON parser dla outputu Llama 8B. Model czasem rzuca
 * `\`\`\`json\n{...}\n\`\`\``, czasem prefix `Oto chipy: {...}`. Wyciagamy
 * pierwszy `{...}` blok i probojemy parsowac.
 */
function extractChipsFromLLMResponse(raw: string): string[] {
  if (!raw || raw.trim().length === 0) return []
  // Pierwsze wystapienie `{` do dopasowanego `}`. Naiwne ale dla outputu
  // Llamy 8B z stricte JSON pasuje w 99% przypadkow.
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return []
  const jsonStr = raw.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(jsonStr) as { chips?: unknown }
    if (!Array.isArray(parsed.chips)) return []
    return parsed.chips
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && c.length <= MAX_CHIP_LENGTH)
      .slice(0, MAX_CHIPS)
  } catch {
    return []
  }
}

/**
 * Generuje smart chipy dla pojedynczej (pytanie, odpowiedz) pary. Zwraca
 * `null` gdy timeout / blad / pusta odpowiedz — caller polega wtedy na
 * statycznych chipach z `followUpChips.ts`.
 *
 * Wewnetrznie owijamy w withGroqRetry (3 proby z exp backoff) ale CALOSC
 * jest pod hard timeoutem `timeoutMs` — wolimy graceful degrade ni
 * zwlekajacy stream.
 */
export async function generateSmartChips(
  opts: SmartChipsOptions,
): Promise<SmartChipsResult> {
  const { userQuery, fullAnswer, toolName, provider, timeoutMs = DEFAULT_TIMEOUT_MS } = opts

  if (!fullAnswer || fullAnswer.trim().length === 0) {
    return null
  }

  // Promise race: LLM call vs hard timeout.
  const llmPromise = (async (): Promise<SmartChipsResult> => {
    const userParts: string[] = [
      `Pytanie usera: ${userQuery}`,
      toolName ? `Uzyte narzedzie: ${toolName}` : '',
      `Odpowiedz Versusia: ${fullAnswer}`,
      'Wygeneruj JSON z chipami follow-up:',
    ].filter((s) => s.length > 0)

    const messages: GroqMessage[] = [
      { role: 'system', content: SMART_CHIPS_SYSTEM_PROMPT },
      { role: 'user', content: userParts.join('\n') },
    ]

    try {
      const result = await withGroqRetry(
        () =>
          provider.completeWithTools(messages, [], {
            model: GROQ_SMALLTALK_MODEL,
            // Maly budzet - JSON z 3 chipami to ~40 tokenow. 80 tok = bufor
            // na ewentualny prefix typu "Oto chipy: " ktory potem odrzucamy.
            maxTokens: 80,
            // Niska temperatura — chcemy deterministyczne JSON, nie poezje.
            temperature: 0.3,
            toolChoice: 'none',
          }),
        // Mniej prob niz synthesizer (2 vs 3) — chipy sa nice-to-have,
        // nie blockerem; zbyt agresywny retry zjada budzet timeoutu.
        2,
      )

      const raw =
        typeof result.message.content === 'string' ? result.message.content : ''
      const chips = extractChipsFromLLMResponse(raw)
      if (chips.length === 0) return null
      return { chips, usage: result.usage }
    } catch (err) {
      console.warn(
        '[SmartChips] generation failed:',
        err instanceof Error ? err.message : err,
      )
      return null
    }
  })()

  const timeoutPromise = new Promise<SmartChipsResult>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs)
  })

  return Promise.race([llmPromise, timeoutPromise])
}
