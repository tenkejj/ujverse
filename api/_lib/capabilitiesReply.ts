/** Ready answers about Versuś; no model invocation needed. */
import { DEFAULT_GROQ_MODEL, GROQ_SMALLTALK_MODEL } from './llmService.js'
import { tryGuideReply } from './guideReplies.js'

const MODEL_PATTERNS: readonly RegExp[] = [
  /^na jakim modelu (działasz|dzialasz|pracujesz)(?: ai)?\??$/i,
  /^jaki(?:ego)? (?:masz|używasz|uzywasz) model(?:u)?(?: ai)?\??$/i,
  /^jakiego modelu (?:używasz|uzywasz)\??$/i,
  /^z jakiego modelu korzystasz\??$/i,
  /^(?:czy )?(?:używasz|uzywasz) (?:groq|groka|gpt[- ]oss)\??$/i,
]

const METHOD_PATTERNS: readonly RegExp[] = [
  /^jak (?:odpowiadasz|działasz|dzialasz)\??$/i,
  /^skąd (?:masz|bierzesz) (?:dane|informacje|odpowiedzi)\??$/i,
  /^skad (?:masz|bierzesz) (?:dane|informacje|odpowiedzi)\??$/i,
  /^na jakiej podstawie odpowiadasz\??$/i,
]

function modelLabel(id: string): string {
  if (id === 'openai/gpt-oss-20b') return 'GPT-OSS 20B'
  if (id === 'openai/gpt-oss-120b') return 'GPT-OSS 120B'
  return id.replace(/([\\`*_[\]<>])/g, '\\$1')
}

const MODEL_TEXT =
  `Korzystam z modeli uruchamianych przez Groq. Do prostszych pytań i układania ` +
  `odpowiedzi używam **${modelLabel(GROQ_SMALLTALK_MODEL)}**, a przy szerszym ` +
  `doborze narzędzi — **${modelLabel(DEFAULT_GROQ_MODEL)}**. ` +
  'Część prostych odpowiedzi przygotowuję bez wywoływania modelu.'

const METHOD_TEXT =
  'Najpierw szukam potrzebnych informacji w danych UJverse, np. komunikatach, ' +
  'terminach USOS lub kalendarzu UJ. Potem układam z nich odpowiedź; przy prostych ' +
  'wynikach model nie jest potrzebny.\n\nNie przeglądam całego internetu na żywo. ' +
  'Dane mogą być opóźnione, a ja mogę się pomylić, dlatego ważne terminy potwierdź w źródle. ' +
  'Do Twojego zapisanego planu mam dostęp dopiero po zalogowaniu.'

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
  'Jestem Versuś, asystent AI w UJverse. Pomagam odnaleźć się w uczelnianych ' +
  'sprawach: szukam informacji i wyjaśniam, co z nich wynika. ' +
  'Korzystam z danych dostępnych w serwisie; ważne terminy warto potwierdzić u źródła.'

const CAPABILITIES_TEXT =
  'Pomogę Ci sprawdzić terminy rejestracji, znaleźć komunikat lub wydarzenie ' +
  'i zajrzeć do zapisanego planu zajęć. Nie musisz znać żadnych komend — ' +
  'napisz choćby „Co mam jutro w planie?”, a poszukam konkretów w dostępnych danych.'

const PUBLIC_CAPABILITIES_TEXT =
  'Pomogę Ci znaleźć komunikat, termin rejestracji, wydarzenie UJ albo informację ' +
  'o wykładowcy — możesz pytać bez logowania. Napisz zwykłe pytanie, np. ' +
  '„Kiedy zaczynają się zapisy?”.\n\nDo Twojego zapisanego planu zajrzę po zalogowaniu.'

/**
 * Zwraca gotową odpowiedź lub `null` gdy wiadomość nie jest pytaniem o możliwości.
 */
export function tryCapabilitiesReply(
  userMessage: string,
  isAuthenticated = true,
): string | null {
  const guide = tryGuideReply(userMessage)
  if (guide) return guide
  const text = userMessage.trim().replace(/\s+/g, ' ')
  if (text.length === 0 || text.length > 80) return null
  for (const pattern of MODEL_PATTERNS) {
    if (pattern.test(text)) return MODEL_TEXT
  }
  for (const pattern of METHOD_PATTERNS) {
    if (pattern.test(text)) return METHOD_TEXT
  }
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(text))
      return isAuthenticated
        ? IDENTITY_TEXT
        : `${IDENTITY_TEXT}\n\nO publiczne informacje możesz pytać bez logowania.`
  }
  for (const pattern of CAPABILITY_PATTERNS) {
    if (pattern.test(text))
      return isAuthenticated ? CAPABILITIES_TEXT : PUBLIC_CAPABILITIES_TEXT
  }
  return null
}
