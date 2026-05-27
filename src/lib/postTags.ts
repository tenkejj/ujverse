const HASHTAG_RE = /#([a-zA-Z0-9_]+)/g

/** Extract unique lowercase hashtags from post body (without `#` prefix). */
export function extractPostTags(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(HASHTAG_RE)) {
    if (m[1]) found.push(m[1].toLowerCase())
  }
  return [...new Set(found)]
}

/** Parse `#tag` search queries for Meilisearch tag filter. */
export function parseTagSearchQuery(query: string): { tag: string | null; textQuery: string } {
  const trimmed = query.trim()
  const m = /^#([a-zA-Z0-9_]+)$/.exec(trimmed)
  if (m?.[1]) return { tag: m[1].toLowerCase(), textQuery: '' }
  return { tag: null, textQuery: trimmed }
}

export function normalizePostTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return [
    ...new Set(
      tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}
