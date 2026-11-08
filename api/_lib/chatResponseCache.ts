/**
 * Response cache chatu — wspólny klucz + TTL dla `api/chat.ts` i `api/prewarm-chat.ts`.
 */

import { buildToolCacheKey } from './cache.js'
import { tryFastPath } from './fastPath.js'
import { chatResponseScope } from './chatAccess.js'
import {
  buildToolFacts,
  formatListedFacts,
  tryCompactSynthesis,
} from './synthesizer.js'

/** Organiczne odpowiedzi Groq / small-talk — krótki TTL. */
export const RESPONSE_CACHE_TTL_SECONDS = 30

/** Fast-path + prewarm — stabilne zapytania (sugerowane pytania). */
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
  conversation?: readonly { role: string; content?: string | null }[],
): string {
  const normalized = lastUserText.trim().toLowerCase().replace(/\s+/g, ' ')
  return buildToolCacheKey('chat_response_v4', {
    text: normalized,
    useTools,
    scope: chatResponseScope(userId),
    // The same follow-up can refer to different information in each conversation.
    ...(conversation && conversation.length > 1
      ? { context: conversation.slice(0, -1) }
      : {}),
  })
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
  const listed = formatListedFacts(facts.facts, facts.hint, facts.topicHint)
  if (listed) return listed
  // 2–3 wyniki — prewarm bez LLM; surowe fakty + hint (cache organic ≠ prewarm).
  const tail = facts.hint ? `\n\n${facts.hint}` : ''
  const text = (facts.facts + tail).trim()
  return text.length > 0 ? text : null
}
