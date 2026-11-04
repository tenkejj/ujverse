/**
 * Bezpieczne linki: zewnętrzne tylko http(s), wewnętrzne „next" tylko w obrębie aplikacji.
 */

/** Zwraca znormalizowany URL http(s) albo `null` (javascript:, data:, śmieci). */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.hostname) return null
  return url.toString()
}

/** Klucz porównania URL-i przy deduplikacji: bez fragmentu, bez końcowego `/`, host małymi literami. */
export function urlDedupKey(raw: string | null | undefined): string | null {
  const safe = safeExternalUrl(raw)
  if (!safe) return null
  const url = new URL(safe)
  url.hash = ''
  const path = url.pathname.replace(/\/+$/, '') || '/'
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`
}

/**
 * Ścieżka powrotu po logowaniu. Akceptujemy wyłącznie ścieżki względne
 * aplikacji (`/coś`), nigdy `//host`, `/\host` ani pełne URL-e — inaczej
 * parametr `next` byłby otwartym przekierowaniem.
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.length > 512) return null
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return null
  }
  let parsed: URL
  try {
    parsed = new URL(value, 'https://ujverse.invalid')
  } catch {
    return null
  }
  if (parsed.origin !== 'https://ujverse.invalid') return null
  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
  if (parsed.pathname === '/logowanie' || parsed.pathname === '/reset-password') return null
  return path
}
