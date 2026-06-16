/**
 * TL;DR do wyświetlenia w karcie komunikatu — preferuje `summary` z Bielika,
 * fallback na pierwsze zdanie z body gdy AI jeszcze nie przetworzyło rekordu.
 */

const JUNK_SUMMARY_RE = /^komunikat(y)?\s+wydziałow/i

function heuristicSummary(body: string, title?: string | null): string | null {
  const t = body.trim()
  if (t.length < 40) return null

  const titleTrim = title?.trim()
  if (titleTrim && t.toLowerCase() === titleTrim.toLowerCase()) return null

  const parts = t.split(/(?<=[.!?])\s+|\n+/)
  const first = parts[0]?.trim() ?? t
  let candidate = first.length >= 30 ? first : t

  if (candidate.length > 200) {
    const spaceIdx = candidate.indexOf(' ', 160)
    candidate =
      spaceIdx > 80 ? `${candidate.slice(0, spaceIdx)}…` : `${candidate.slice(0, 200)}…`
  }

  if (titleTrim && candidate.toLowerCase() === titleTrim.toLowerCase()) return null
  return candidate.length >= 25 ? candidate : null
}

export function pickDisplaySummary(
  summary: string | null | undefined,
  body: string,
  title?: string | null,
): string | null {
  const fromAi = summary?.trim()
  if (fromAi && fromAi.length > 0 && !JUNK_SUMMARY_RE.test(fromAi)) return fromAi
  return heuristicSummary(body, title)
}
