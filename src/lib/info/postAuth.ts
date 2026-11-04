/**
 * Cel powrotu po logowaniu (także po przekierowaniu OAuth, które wraca na `/`).
 * Trzymany w sessionStorage, ważny 30 minut, zawsze przepuszczany przez
 * `sanitizeNextPath`, więc nie da się nim przekierować poza aplikację.
 */
import { sanitizeNextPath } from './links'

const KEY = 'ujverse.postAuthPath.v1'
const MAX_AGE_MS = 30 * 60_000

export function rememberPostAuthPath(path: string | null): void {
  const safe = sanitizeNextPath(path)
  try {
    if (!safe) window.sessionStorage.removeItem(KEY)
    else window.sessionStorage.setItem(KEY, JSON.stringify({ path: safe, at: Date.now() }))
  } catch {
    /* brak sessionStorage — po logowaniu wracamy na stronę startową */
  }
}

export function consumePostAuthPath(): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_AGE_MS) return null
    return sanitizeNextPath(typeof parsed.path === 'string' ? parsed.path : null)
  } catch {
    return null
  }
}

export function loginPathFor(next: string, mode: 'login' | 'signup' = 'login'): string {
  const safe = sanitizeNextPath(next)
  const params = new URLSearchParams()
  if (safe && safe !== '/') params.set('next', safe)
  if (mode === 'signup') params.set('tryb', 'rejestracja')
  const query = params.toString()
  return query ? `/logowanie?${query}` : '/logowanie'
}
