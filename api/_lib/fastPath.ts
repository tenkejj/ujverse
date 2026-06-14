/**
 * Fast-Path Bypass — najgrubsza optymalizacja kosztu Groqa.
 *
 * Idea: dla zapytań o WYSOKIEJ pewności (slash commands z `chatSlashCommands.ts`,
 * exact-match popularnych pytań) nie wołamy LLM-a wcale. Klasyfikator regex
 * decyduje, które narzędzie odpalić, jakimi argumentami — i przekazujemy
 * to bezpośrednio do `getToolEntry(name).execute(args, ctx)`. Wynik
 * formattujemy server-side i streamujemy SSE jak normalna odpowiedź.
 *
 * Zysk per slash-command query:
 *   - 0 input tokenów do Groqa (~1100 saved)
 *   - 0 output tokenów do Groqa (~200 saved)
 *   - Latency: ~50ms vs ~1500ms (Groq round-trip eliminated)
 *
 * Bezpieczeństwo: fast-path jest CELOWO konserwatywny — pattern musi pasować
 * do całej wiadomości userskiej (`^...$`), bez żadnych dopisków. „Pokaż zniżki
 * studenckie i kup mi piwo" NIE pasuje (są dopiski) → leci do Groqa, który
 * sam rozkmini. Wolimy false-negative (niepotrzebny LLM call) niż false-positive
 * (model czegoś nie powie).
 *
 * Ranges (`get_*_in_range`, `get_calendar_in_range`) — generujemy świeże ISO
 * w UTC w handlerze. Per-tool cache i tak wpada na ten sam klucz (args są
 * deterministyczne dla tego samego dnia), więc cache layer w `runWithCache`
 * dalej działa.
 */

export type FastPathMatch = {
  toolName: string
  args: Record<string, unknown>
  /** Etykieta dla logów — dlaczego ten match wpadł. */
  reason: string
}

type FastPathRule = {
  patterns: readonly RegExp[]
  toolName: string
  buildArgs: () => Record<string, unknown>
  reason: string
}

/** Zwraca ISO 8601 dla początku i końca dzisiaj w UTC. */
function todayRangeISO(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
    ),
  )
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Zwraca ISO 8601 dla zakresu next 7 days od dziś (UTC). */
function nextSevenDaysISO(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  )
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Reguły fast-path. Lista jest świadomie krótka — pokrywamy 11 slash commands
 * z `src/lib/chatSlashCommands.ts` plus parę bardzo popularnych wariantów.
 *
 * Kolejność reguł nie ma znaczenia — first-match wygrywa, ale patterny
 * są wzajemnie wykluczające.
 */
const RULES: readonly FastPathRule[] = [
  // /feed — "Co nowego na feedzie?"
  {
    patterns: [
      /^co nowego na feedzie\??$/i,
      /^co na feedzie\??$/i,
      /^pokaż feed\??$/i,
      /^pokaz feed\??$/i,
      /^najnowsze posty\??$/i,
    ],
    toolName: 'get_latest_posts',
    buildArgs: () => ({}),
    reason: 'feed',
  },

  // /oglosznia — "Najnowsze ogłoszenia"
  {
    patterns: [
      /^najnowsze ogłoszenia\??$/i,
      /^najnowsze ogloszenia\??$/i,
      /^pokaż ogłoszenia\??$/i,
      /^pokaz ogloszenia\??$/i,
      /^ogłoszenia\??$/i,
      /^ogloszenia\??$/i,
      /^pokaż ogłoszenia z wydziału zarządzania i komunikacji społecznej\??$/i,
      /^pokaz ogloszenia z wydzialu zarzadzania i komunikacji spolecznej\??$/i,
    ],
    toolName: 'get_latest_announcements',
    buildArgs: () => ({}),
    reason: 'announcements',
  },

  // /tydzien — "Co w przyszłym tygodniu?"
  {
    patterns: [
      /^co w przyszłym tygodniu\??$/i,
      /^co w przyszlym tygodniu\??$/i,
      /^co dzieje się w tym tygodniu\??$/i,
      /^co sie dzieje w tym tygodniu\??$/i,
      /^co w tym tygodniu na uj\??$/i,
    ],
    toolName: 'get_calendar_in_range',
    buildArgs: () => {
      const r = nextSevenDaysISO()
      return { range_start: r.start, range_end: r.end }
    },
    reason: 'next_week',
  },

  // /naukowe — "Wydarzenia naukowe"
  {
    patterns: [
      /^wydarzenia naukowe\??$/i,
      /^naukowe wydarzenia\??$/i,
      /^konferencje naukowe\??$/i,
    ],
    toolName: 'search_events',
    buildArgs: () => ({ query: 'nauk' }),
    reason: 'science_events',
  },

  // /juwenalia
  {
    patterns: [
      /^kiedy są juwenalia( uj)?\??$/i,
      /^kiedy sa juwenalia( uj)?\??$/i,
      /^juwenalia( uj)?\??$/i,
    ],
    toolName: 'search_events',
    buildArgs: () => ({ query: 'juwenalia' }),
    reason: 'juwenalia',
  },

  // /zniski — "Pokaż zniżki studenckie"
  {
    patterns: [
      /^pokaż zniżki studenckie\??$/i,
      /^pokaz znizki studenckie\??$/i,
      /^zniżki studenckie\??$/i,
      /^znizki studenckie\??$/i,
      /^zniżki\??$/i,
      /^znizki\??$/i,
      /^kupony studenckie\??$/i,
    ],
    toolName: 'search_discounts',
    buildArgs: () => ({}),
    reason: 'discounts',
  },

  // /trending — "Jakie zniżki są teraz najpopularniejsze?"
  {
    patterns: [
      /^jakie zniżki są teraz najpopularniejsze\??$/i,
      /^jakie znizki sa teraz najpopularniejsze\??$/i,
      /^najpopularniejsze zniżki\??$/i,
      /^najpopularniejsze znizki\??$/i,
      /^trendujące zniżki\??$/i,
      /^trendujace znizki\??$/i,
      /^top zniżki\??$/i,
      /^top znizki\??$/i,
    ],
    toolName: 'get_trending_discounts',
    buildArgs: () => ({}),
    reason: 'trending_discounts',
  },

  // /plan — "Co mam dziś w planie?"
  {
    patterns: [
      /^co mam dziś w planie\??$/i,
      /^co mam dzis w planie\??$/i,
      /^co mam dziś\??$/i,
      /^co mam dzis\??$/i,
      /^mój plan na dziś\??$/i,
      /^moj plan na dzis\??$/i,
      /^plan na dziś\??$/i,
      /^plan na dzis\??$/i,
    ],
    toolName: 'get_my_classes_in_range',
    buildArgs: () => {
      const r = todayRangeISO()
      return { range_start: r.start, range_end: r.end }
    },
    reason: 'my_classes_today',
  },

  // /brief — "Pokaż mój briefing tygodniowy"
  {
    patterns: [
      /^pokaż mój briefing tygodniowy\??$/i,
      /^pokaz moj briefing tygodniowy\??$/i,
      /^mój briefing\??$/i,
      /^moj briefing\??$/i,
      /^briefing tygodniowy\??$/i,
      /^briefing\??$/i,
    ],
    toolName: 'get_my_weekly_briefing',
    buildArgs: () => ({}),
    reason: 'weekly_briefing',
  },

  // /rejestracje — "Jakie są nadchodzące rejestracje USOS?"
  {
    patterns: [
      /^jakie są nadchodzące rejestracje usos\??$/i,
      /^jakie sa nadchodzace rejestracje usos\??$/i,
      /^nadchodzące rejestracje usos\??$/i,
      /^nadchodzace rejestracje usos\??$/i,
      /^rejestracje usos\??$/i,
      /^rejestracje\??$/i,
    ],
    toolName: 'get_upcoming_usos_registrations',
    buildArgs: () => ({}),
    reason: 'usos_registrations',
  },
]

/**
 * Sprawdza, czy ostatnia wiadomość użytkownika pasuje do reguły fast-path.
 * Zwraca dopasowanie lub `null` (idziemy normalną ścieżką do Groqa).
 *
 * Normalizacja: trim + collapse whitespace. NIE robimy lower-case (regexy
 * mają flagę `i`), ale ucinamy whitespace żeby „  zniżki  " też pasował.
 */
export function tryFastPath(userMessage: string): FastPathMatch | null {
  const text = userMessage.trim().replace(/\s+/g, ' ')
  if (text.length === 0 || text.length > 120) return null

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          toolName: rule.toolName,
          args: rule.buildArgs(),
          reason: rule.reason,
        }
      }
    }
  }
  return null
}
