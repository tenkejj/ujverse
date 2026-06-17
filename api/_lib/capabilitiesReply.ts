/**
 * Capabilities Reply — zero-tokenowa odpowiedź na „co potrafisz?" / pomoc.
 *
 * Slash `/pomoc` i podobne pytania nie wymagają Qwen3 — Versuś sam wie,
 * co umie. Oszczędza ~1.3k tok per zapytanie i daje spójną listę funkcji.
 */

const CAPABILITY_PATTERNS: readonly RegExp[] = [
  /^co (potrafisz|umiesz|możesz)(\s+zrobić)?\??$/i,
  /^co (potrafisz|umiesz|mozesz)(\s+zrobic)?\??$/i,
  /^czym się zajmujesz\??$/i,
  /^czym sie zajmujesz\??$/i,
  /^jakie masz funkcje\??$/i,
  /^pomoc\??$/i,
  /^help\??$/i,
  /^\/pomoc\??$/i,
]

const IDENTITY_PATTERNS: readonly RegExp[] = [
  /^kim jesteś\??$/i,
  /^kim jestes\??$/i,
  /^kto to jest versuś\??$/i,
  /^kto to jest versus\??$/i,
  /^co to jest versuś\??$/i,
  /^co to jest versus\??$/i,
]

const IDENTITY_TEXT =
  'Jestem Versuś — kumpelski asystent UJverse z Krakowa. Znam uczelnię, miasto ' +
  'i studencki klimat. Sprawdzam plan, ogłoszenia, zniżki, wydarzenia i resztę ' +
  'z bazy — pisz normalnie albo użyj slashy typu /plan czy /zniski.'

const CAPABILITIES_TEXT =
  'Jestem Versuś — Twój kumpel z UJverse. Mogę sprawdzić plan z USOS i odwołane zajęcia, ' +
  'ogłoszenia wykładowców, wydarzenia w Krakowie, zniżki studenckie, co siedzi na feedzie, ' +
  'rejestracje USOS, briefing tygodniowy, Aulę albo znaleźć wykładowcę. ' +
  'Pisz normalnie albo użyj slashy — /plan, /zniski, /oglosznia, /brief — to trafia prosto w temat.'

/**
 * Zwraca gotową odpowiedź lub `null` gdy wiadomość nie jest pytaniem o możliwości.
 */
export function tryCapabilitiesReply(userMessage: string): string | null {
  const text = userMessage.trim().replace(/\s+/g, ' ')
  if (text.length === 0 || text.length > 80) return null
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(text)) return IDENTITY_TEXT
  }
  for (const pattern of CAPABILITY_PATTERNS) {
    if (pattern.test(text)) return CAPABILITIES_TEXT
  }
  return null
}
