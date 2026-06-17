/**
 * Response cache chatu — wspólny klucz + TTL dla `api/chat.ts` i `api/prewarm-chat.ts`.
 */

import { buildToolCacheKey } from './cache.js'
import { tryFastPath } from './fastPath.js'
import { isPersonalTool } from './personalTools.js'
import { buildToolFacts, tryCompactSynthesis } from './synthesizer.js'

/** Organiczne odpowiedzi Groq / small-talk — krótki TTL. */
export const RESPONSE_CACHE_TTL_SECONDS = 30

/** Fast-path + prewarm — stabilne zapytania (chipy, slashy). */
export const RESPONSE_CACHE_FAST_PATH_TTL_SECONDS = 300

export function responseCacheTtlSeconds(
  lastUserText: string,
  opts?: { fastPathReason?: string },
): number {
  if (opts?.fastPathReason) return RESPONSE_CACHE_FAST_PATH_TTL_SECONDS
  if (tryFastPath(lastUserText)) return RESPONSE_CACHE_FAST_PATH_TTL_SECONDS
  return RESPONSE_CACHE_TTL_SECONDS
}

export function buildResponseCacheKey(
  lastUserText: string,
  useTools: boolean,
  userId?: string | null,
): string {
  const normalized = lastUserText.trim().toLowerCase().replace(/\s+/g, ' ')
  const match = tryFastPath(lastUserText)
  const scope =
    match && isPersonalTool(match.toolName) ? (userId ?? 'anon') : 'shared'
  return buildToolCacheKey('chat_response', { text: normalized, useTools, scope })
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
