/**
 * User Memory — krotka pamiec o userze ekstrahowana z konwersacji.
 *
 * Po co: auto-context daje JEDNORAZOWE dane z `profiles` (imie, kierunek,
 * rok) i czas. Ale w realnej rozmowie user wyjawia preferencje ktorych
 * w profilu nie ma:
 *   - "Jestem na diecie weganskiej" -> nie pokazuj zniżek na steki
 *   - "Mieszkam na Kazimierzu" -> priorytetyzuj okolice tej dzielnicy
 *   - "Boje sie egzaminow z algebry" -> ostrozny ton przy briefingu
 *   - "Zaliczyl wczoraj rozliczenie z BWA" -> nie pytaj ciaglej
 *
 * Memory zbiera te "fakty o userze" w KV i wstrzykuje do auto-contextu,
 * zeby model pamietal preferencje miedzy sesjami.
 *
 * Architektura:
 *  - Storage: Vercel KV `chat_memory:<userId>` -> { facts: string[], ts: number }
 *  - TTL: 7 dni (preferencje sie zmieniaja, ale nie codziennie)
 *  - Max 5 faktow (token economy w auto-context)
 *  - Update trigger: co 3 tury rozmowy, fire-and-forget po SSE done
 *  - Ekstrakcja: Llama 8B z restrykcyjnym JSON-only promptem
 *
 * Bezpieczenstwo / privacy:
 *  - User moze zobaczyc memory (przyszly endpoint `GET /api/me/memory`)
 *  - User moze wyczyscic memory (przyszly endpoint `DELETE /api/me/memory`)
 *  - Anon (brak userId) - skip, nie zapisujemy
 *  - Fakty zawierajace PII (email, telefon, adres) odfiltrowujemy przez
 *    `redactPII` przed zapisem
 */

import {
  GroqProvider,
  type GroqUsage,
} from './GroqProvider.js'
import { kvGetSafe, kvSetSafe, kvDelSafe } from './kvCache.js'
import { GROQ_SMALLTALK_MODEL, withGroqRetry } from './llmService.js'
import { redactPII } from './piiRedact.js'
import type { GroqMessage } from './types.js'

const MEMORY_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 dni
const MAX_FACTS = 5
const MAX_FACT_LENGTH = 80
/**
 * Po ilu USER message-ach robimy update. 3 = po kazdym trzeciej turze
 * (user+assistant para = 1 tura). Czesciej oznacza wieksze koszty Groqa
 * (extraction call), rzadziej oznacza ze nowe preferencje siedza dluzej
 * niewidoczne dla bota.
 */
const UPDATE_EVERY_N_USER_MESSAGES = 6

type StoredMemory = {
  facts: string[]
  ts: number
}

const STORAGE_KEY = (userId: string) => `chat_memory:${userId}`

/**
 * System prompt dla ekstrakcji faktow. Restrictive, JSON-only.
 */
const EXTRACTION_SYSTEM_PROMPT = `Analityk rozmów Versusia (UJverse). Z historii + obecnych faktów zwróć JSON: {"facts": ["...", ...]}.
Max 5 faktów, max 80 znaków, po polsku, 3os. Tylko STABILNE preferencje (dieta, dzielnica, hobby) — nie pojedyncze zdarzenia. Bez PII. Zachowaj aktualne fakty gdy pasują. Brak nowych → zwróć bez zmian.`

/**
 * Pobiera memory z KV. Fail-safe: blad KV -> null, caller leci bez memory.
 */
export async function getUserMemory(userId: string): Promise<string[] | null> {
  if (!userId) return null
  const cached = await kvGetSafe<StoredMemory>(STORAGE_KEY(userId))
  if (!cached || !Array.isArray(cached.facts)) return null
  return cached.facts.slice(0, MAX_FACTS)
}

/**
 * Tolerancyjny JSON parser - Llama 8B czasem dorzuca prefix "Oto fakty: ...".
 */
function extractFactsFromLLMResponse(raw: string): string[] {
  if (!raw || raw.trim().length === 0) return []
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return []
  const jsonStr = raw.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(jsonStr) as { facts?: unknown }
    if (!Array.isArray(parsed.facts)) return []
    return parsed.facts
      .filter((f): f is string => typeof f === 'string')
      .map((f) => f.trim())
      .map((f) => redactPII(f)) // belt-and-suspenders: nie zapisujemy PII
      .filter((f) => f.length > 0 && f.length <= MAX_FACT_LENGTH)
      .slice(0, MAX_FACTS)
  } catch {
    return []
  }
}

export type MemoryUpdateOptions = {
  userId: string | null
  conversation: GroqMessage[]
  provider: GroqProvider
  /**
   * Jezeli wymuszamy update niezaleznie od triggera (np. po dlugim message
   * z konkretna preferencja). Default false = update tylko co N tur.
   */
  force?: boolean
}

export type MemoryUpdateResult = {
  updated: boolean
  usage: GroqUsage | null
  reason: 'no_user' | 'throttled' | 'extracted' | 'no_change' | 'error'
}

/**
 * Decyzja czy w ogole robic update teraz - bazujemy na liczbie user
 * messages w historii. Modulo `UPDATE_EVERY_N_USER_MESSAGES`.
 */
function shouldUpdateNow(conversation: GroqMessage[]): boolean {
  const userMessages = conversation.filter((m) => m.role === 'user').length
  if (userMessages === 0) return false
  return userMessages % UPDATE_EVERY_N_USER_MESSAGES === 0
}

/**
 * Aktualizuje memory uzytkownika na bazie historii rozmowy. Fire-and-forget
 * w `api/chat.ts` (po wyslaniu odpowiedzi do usera). Nie blokuje SSE.
 *
 * Throttling: tylko co N user messages (default 3). Wymuszenie przez `force`.
 *
 * Idempotentne: jezeli LLM ekstrakcja zwroci te same fakty, nie nadpisujemy
 * KV (oszczednosc write quota).
 */
export async function updateUserMemory(
  opts: MemoryUpdateOptions,
): Promise<MemoryUpdateResult> {
  const { userId, conversation, provider, force = false } = opts

  if (!userId) {
    return { updated: false, usage: null, reason: 'no_user' }
  }
  if (!force && !shouldUpdateNow(conversation)) {
    return { updated: false, usage: null, reason: 'throttled' }
  }

  const existing = (await getUserMemory(userId)) ?? []
  const existingJson = JSON.stringify({ facts: existing })

  // Wycigamy ostatnich 6 message-y (user + assistant) - wiekszy kontekst,
  // mniej tokenow niz cala historia (model i tak zostal przyciety w pruneHistory).
  const tail = conversation.slice(-6)
  const transcript = tail
    .map((m) => `${m.role.toUpperCase()}: ${redactPII(m.content)}`)
    .join('\n')

  const userParts: string[] = [
    `Obecne fakty o userze: ${existingJson}`,
    'Fragment rozmowy:',
    transcript,
    'Zaktualizuj fakty:',
  ]

  const messages: GroqMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ]

  try {
    const result = await withGroqRetry(
      () =>
        provider.completeWithTools(messages, [], {
          model: GROQ_SMALLTALK_MODEL,
          maxTokens: 200,
          // Niska temperatura - chcemy stabilna ekstrakcje, nie kreatywnosc.
          temperature: 0.2,
          toolChoice: 'none',
        }),
      2, // 2 proby (memory update to nice-to-have, nie blocker)
    )

    const raw =
      typeof result.message.content === 'string' ? result.message.content : ''
    const newFacts = extractFactsFromLLMResponse(raw)

    if (newFacts.length === 0) {
      // Brak factow / parser failed - nie nadpisujemy (zachowaj stare).
      return { updated: false, usage: result.usage, reason: 'no_change' }
    }

    // Idempotency: nie zapisuj jezeli set sie nie zmienil.
    const newJson = JSON.stringify({ facts: newFacts })
    if (newJson === existingJson) {
      return { updated: false, usage: result.usage, reason: 'no_change' }
    }

    const stored: StoredMemory = {
      facts: newFacts,
      ts: Date.now(),
    }
    await kvSetSafe(STORAGE_KEY(userId), stored, MEMORY_TTL_SECONDS)
    console.log(
      '[UserMemory] updated for user',
      userId,
      '— facts:',
      newFacts.length,
    )
    return { updated: true, usage: result.usage, reason: 'extracted' }
  } catch (err) {
    console.warn(
      '[UserMemory] update failed:',
      err instanceof Error ? err.message : err,
    )
    return { updated: false, usage: null, reason: 'error' }
  }
}

/**
 * Formatuje memory jako linia do auto-context. Zwraca pusty string
 * jezeli brak factow - caller (`autoContext.ts`) decyduje czy
 * w ogole dolaczac.
 */
export function formatMemoryForContext(facts: string[] | null): string {
  if (!facts || facts.length === 0) return ''
  const joined = facts.map((f) => f.replace(/[.;]$/, '')).join('; ')
  return `Pamiętasz o userze: ${joined}.`
}

/** Usuwa zapamiętane preferencje usera (np. z ustawień / DELETE /api/me/memory). */
export async function clearUserMemory(userId: string): Promise<boolean> {
  try {
    await kvDelSafe(STORAGE_KEY(userId))
    return true
  } catch {
    return false
  }
}
