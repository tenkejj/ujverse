/**
 * Response cache chatu — wspólny klucz + TTL dla `api/chat.ts` i `api/prewarm-chat.ts`.
 */

import { buildToolCacheKey } from './cache.js'
import { buildToolFacts, tryCompactSynthesis } from './synthesizer.js'

/** Zsynchronizowane z `api/chat.ts` — anty-spam + oszczędność Qwen3. */
export const RESPONSE_CACHE_TTL_SECONDS = 30

export function buildResponseCacheKey(
  lastUserText: string,
  useTools: boolean,
): string {
  const normalized = lastUserText.trim().toLowerCase().replace(/\s+/g, ' ')
  return buildToolCacheKey('chat_response', { text: normalized, useTools })
}

/**
 * Formatuje wynik narzędzia do zapisu w KV (prewarm / offline cache).
 * Bez wywołania Llama 8B — direct, kompakt lub surowe fakty.
 */
export function formatToolResultForCache(
  toolName: string,
  result: unknown,
  userQuery: string,
): string | null {
  const facts = buildToolFacts(toolName, result)
  if (facts.kind === 'direct') {
    return facts.text.trim().length > 0 ? facts.text : null
  }
  const compact = tryCompactSynthesis(userQuery, facts.facts, facts.hint)
  if (compact) return compact
  const tail = facts.hint ? `\n\n${facts.hint}` : ''
  const text = (facts.facts + tail).trim()
  return text.length > 0 ? text : null
}
