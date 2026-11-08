/** Ready answers about Versuś; no model invocation needed. */

const CAPABILITY_PATTERNS: readonly RegExp[] = [
  /^co (potrafisz|umiesz|możesz)(\s+zrobić)?\??$/i,
  /^co (potrafisz|umiesz|mozesz)(\s+zrobic)?\??$/i,
  /^czym się zajmujesz\??$/i,
  /^czym sie zajmujesz\??$/i,
  /^jakie masz funkcje\??$/i,
  /^pomoc\??$/i,
  /^help\??$/i,
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
  'Jestem Versuś, asystent UJverse. Pomagam znaleźć informacje z uczelni ' +
  'i uporządkować studenckie sprawy. Napisz zwykłe pytanie, np. „Jakie są najbliższe wydarzenia na UJ?”.'

const CAPABILITIES_TEXT =
  'Sprawdzę komunikaty wydziałowe, terminy rejestracji USOS i wydarzenia UJ. ' +
  'Pomogę też znaleźć wykładowcę, zajrzeć do Twojego planu i przygotować podsumowanie. ' +
  'Zapytaj np. „Co mam jutro w planie?” albo „Czy są nowe komunikaty?”.'

const PUBLIC_CAPABILITIES_TEXT =
  'Bez logowania sprawdzę komunikaty wydziałowe, rejestracje USOS, wydarzenia UJ ' +
  'i informacje o wykładowcach. Zapytaj np. „Jakie są najbliższe wydarzenia?”.\n\n' +
  'Do Twojego planu i pozostałych informacji z konta potrzebuję zalogowania.'

/**
 * Zwraca gotową odpowiedź lub `null` gdy wiadomość nie jest pytaniem o możliwości.
 */
export function tryCapabilitiesReply(
  userMessage: string,
  isAuthenticated = true,
): string | null {
  const text = userMessage.trim().replace(/\s+/g, ' ')
  if (text.length === 0 || text.length > 80) return null
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(text))
      return isAuthenticated ? IDENTITY_TEXT : PUBLIC_CAPABILITIES_TEXT
  }
  for (const pattern of CAPABILITY_PATTERNS) {
    if (pattern.test(text))
      return isAuthenticated ? CAPABILITIES_TEXT : PUBLIC_CAPABILITIES_TEXT
  }
  return null
}
