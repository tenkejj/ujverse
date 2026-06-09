/**
 * searchCommands — parser slash-komend dla OmniSearchHub (System 5).
 *
 * Reguły:
 *  - `/ciemny`  → action `theme-dark`  (czyści input)
 *  - `/jasny`   → action `theme-light` (czyści input)
 *  - `/uj`      → action `theme-uj`    (czyści input, włącza motyw Akademicki)
 *  - `/p <q>`   → mode `profiles`     (zawęża sekcje do profili)
 *  - `/k <q>`   → mode `komunikaty`   (zawęża sekcje do komunikatów)
 *  - inne       → mode `all`, brak akcji
 *
 * Funkcja jest pure — nie korzysta z React, nadaje się do testów jednostkowych.
 */

export type OmniMode = 'all' | 'profiles' | 'komunikaty'

export type SearchCommandAction = 'theme-dark' | 'theme-light' | 'theme-uj' | null

export type ParsedCommand = {
  mode: OmniMode
  /** Zapytanie po odjęciu prefiksu komendy. */
  stripped: string
  /** Akcja natychmiastowa (np. zmiana motywu) — wykonywana raz, gdy nie-null. */
  action: SearchCommandAction
}

const DARK_RE = /^\/ciemny\b/i
const LIGHT_RE = /^\/jasny\b/i
const UJ_RE = /^\/uj\b/i
const PROFILE_RE = /^\/p(?:\s+|$)/i
const KOMUNIKAT_RE = /^\/k(?:\s+|$)/i

export function parseSearchCommand(raw: string): ParsedCommand {
  const t = raw.trimStart()

  if (DARK_RE.test(t)) {
    return { mode: 'all', stripped: '', action: 'theme-dark' }
  }
  if (LIGHT_RE.test(t)) {
    return { mode: 'all', stripped: '', action: 'theme-light' }
  }
  if (UJ_RE.test(t)) {
    return { mode: 'all', stripped: '', action: 'theme-uj' }
  }
  if (PROFILE_RE.test(t)) {
    return { mode: 'profiles', stripped: t.replace(PROFILE_RE, ''), action: null }
  }
  if (KOMUNIKAT_RE.test(t)) {
    return { mode: 'komunikaty', stripped: t.replace(KOMUNIKAT_RE, ''), action: null }
  }

  return { mode: 'all', stripped: raw, action: null }
}
