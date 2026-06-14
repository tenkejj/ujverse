/**
 * Intent Router — najgrubsza optymalizacja wejściowych tokenów.
 *
 * Problem: bez routingu wysyłamy do Groqa schemat WSZYSTKICH 13 narzędzi
 * (~700-900 tokenów `tools[]` JSON Schema) przy każdym requeście, mimo że
 * model zwykle używa 1, czasem 2. Płacimy za 11 nieużywanych schematów per
 * call.
 *
 * Rozwiązanie: tani regex/keyword classifier zwraca podzbiór nazw narzędzi
 * istotnych dla intencji ostatniej wiadomości użytkownika. Orchestrator
 * filtruje pełną tablicę narzędzi po nazwie i wysyła tylko podzbiór.
 *
 * Heurystyki są CELOWO konserwatywne — wolimy "false positive" (model
 * dostaje 1-2 narzędzia więcej, którymi nie skorzysta — kosztuje ~80 tok)
 * niż "false negative" (model nie ma narzędzia, którego potrzebował —
 * halucynuje albo odmawia odpowiedzi).
 *
 * Multi-intent: gdy match-uje się więcej niż jedna kategoria (np.
 * "co mam dziś i jakie są zniżki"), zwracamy SUMĘ narzędzi (deduplikacja
 * w `routeIntent`).
 *
 * Fallback: gdy żaden keyword nie pasuje (rzadkie pytania w stylu
 * "powiedz mi coś ciekawego"), zwracamy `null` — orchestrator wyśle
 * pełen zestaw 13 narzędzi (zachowanie sprzed routera).
 */

/** Wszystkie nazwy narzędzi w jednym miejscu — typecheck przy refactor. */
export type ToolName =
  | 'search_events'
  | 'get_latest_announcements'
  | 'get_latest_posts'
  | 'get_calendar_in_range'
  | 'search_discounts'
  | 'get_trending_discounts'
  | 'get_my_classes_in_range'
  | 'get_my_weekly_briefing'
  | 'get_upcoming_usos_registrations'
  | 'get_upcoming_official_events'
  | 'find_user'
  | 'get_my_user_context'
  | 'get_my_aula_overview'
  | 'find_lecturer'
  | 'get_lecturer_announcements_by_name'
  | 'get_my_followed_lecturers'

/**
 * Mapa intent → narzędzia. Wyodrębniona, żeby łatwo dorzucać nowe narzędzia
 * (dodajesz do odpowiedniej intencji + ewentualnie nowe `INTENT_KEYWORDS`).
 */
const INTENT_TO_TOOLS: Record<string, ToolName[]> = {
  discounts: ['search_discounts', 'get_trending_discounts'],
  events: ['search_events', 'get_upcoming_official_events'],
  calendar: ['get_calendar_in_range'],
  classes: ['get_my_classes_in_range'],
  briefing: ['get_my_weekly_briefing'],
  usos: ['get_upcoming_usos_registrations'],
  announcements: ['get_latest_announcements'],
  posts: ['get_latest_posts'],
  find_user: ['find_user'],
  me: ['get_my_user_context'],
  aula: ['get_my_aula_overview'],
  lecturer_search: ['find_lecturer'],
  lecturer_announcements: ['get_lecturer_announcements_by_name', 'find_lecturer'],
  followed_lecturers: ['get_my_followed_lecturers'],
}

/**
 * Słowniki keywordów per-intent. Każdy keyword to substring (case-insensitive)
 * — match na `userMessage.toLowerCase()`. Polskie diakrytyki traktowane
 * literalnie; zarówno z, jak i bez (np. "znizki" i "zniżki").
 *
 * Świadomie używamy substring zamiast `\b...\b` — odmiana po polsku jest
 * kosztowna do regexowania, a substring "zniżk" łapie "zniżki", "zniżek",
 * "zniżkach" itp.
 */
const INTENT_KEYWORDS: Record<string, readonly string[]> = {
  discounts: [
    'zniżk',
    'znizk',
    'kupon',
    'rabat',
    'taniej',
    'najtaniej',
    'promocj',
    'couponek',
    'oferta studen',
    'gdzie taniej',
    'gdzie tanio',
    'wyprzed',
    'discount',
  ],
  events: [
    'wydarzeni',
    'koncert',
    'konferencj',
    'sympozjum',
    'sympozja',
    'panel',
    'juwenali',
    'event',
    'kalendarz uj',
    'co na uj',
    'co się dzieje na uj',
    'co sie dzieje na uj',
  ],
  calendar: [
    'kalendarz',
    'dzień woln',
    'dzien woln',
    'dni woln',
    'odwołane zaję',
    'odwolane zaje',
    'dyżur',
    'dyzur',
    'zdaln',
    'przeniesion',
    'nieobecn',
  ],
  classes: [
    'co mam dziś',
    'co mam dzis',
    'co mam jutro',
    'co mam w pon',
    'co mam we wt',
    'co mam w śro',
    'co mam w sro',
    'co mam w czw',
    'co mam w pt',
    'co mam w pią',
    'co mam w pia',
    'co mam w sob',
    'co mam w nied',
    'mój plan',
    'moj plan',
    'plan na dziś',
    'plan na dzis',
    'plan na jutro',
    'plan na ten tydz',
    'plan na przyszł',
    'plan na przyszl',
    'moje zaję',
    'moje zaje',
    'mam zajęc',
    'mam zajec',
  ],
  briefing: [
    'briefing',
    'podsumowanie tygodnia',
    'co ważne w tym tygod',
    'co wazne w tym tygod',
    'co ważne tym tygod',
    'co wazne tym tygod',
    'co mam w tym tygodniu',
  ],
  usos: [
    'usos',
    'rejestracj',
    'lektorat',
    'lektoraty',
    'wf ',
    'wf?',
    'kiedy wf',
    'zapis na',
    'zapisać się',
    'zapisac sie',
  ],
  announcements: [
    'ogłosz',
    'oglosz',
    'komunikat',
    'isi uj',
    'isi.uj',
    'najnowsz',
    'wziks',
    'wmif',
    'wpia',
    'wfais',
    'wbbib',
  ],
  posts: [
    'feed',
    'co na feedzie',
    'co krąży',
    'co krazy',
    'dyskusj',
    'wpis społ',
    'co piszą',
    'co pisza',
    'nastroj',
  ],
  find_user: [
    'znajdź',
    'znajdz',
    'kto to jest',
    'kto to ',
    'pokaż profil',
    'pokaz profil',
    'szukam ',
    'szukam koleżank',
    'szukam kolegi',
    'wyszukaj uż',
    'wyszukaj uz',
  ],
  me: [
    'kim jestem',
    'co o mnie wiesz',
    'co wiesz o mnie',
    'mój profil',
    'moj profil',
    'jakie mam stud',
    'na którym roku',
    'na ktorym roku',
    'spersonalizow',
    'dla mnie',
    'pod mnie',
  ],
  aula: [
    'aula',
    'mój rocznik',
    'moj rocznik',
    'rocznik',
    'deadlin',
    'zadania do',
    'mam zadan',
    'jakie mam zadan',
    'ile zadan',
    'ile zadań',
    'głosowani',
    'glosowani',
    'ankiet',
  ],
  lecturer_announcements: [
    'co napisał',
    'co napisal',
    'co napisała',
    'co napisala',
    'ogłoszenia od',
    'ogloszenia od',
    'wpisy od dr',
    'wpisy od prof',
    'co mówi dr',
    'co mowi dr',
    'co mówi prof',
    'co mowi prof',
    'co u dr',
    'co u prof',
  ],
  lecturer_search: [
    'kontakt do dr',
    'kontakt do prof',
    'kto to dr',
    'kto to prof',
    'znajdź wykładow',
    'znajdz wykladow',
    'pokaż wykładow',
    'pokaz wykladow',
    'kim jest dr',
    'kim jest prof',
  ],
  followed_lecturers: [
    'kogo subskrybuję',
    'kogo subskrybuje',
    'moi wykładow',
    'moi wykladow',
    'kogo śledzę',
    'kogo sledze',
    'subskrybow',
    'subskrypcj',
    'co u moich wykładow',
    'co u moich wykladow',
  ],
}

/**
 * Heurystyka "personalnych" pytań — gdy jest, dorzucamy `get_my_user_context`
 * jako sidekick (model lubi go najpierw zawołać dla personalizacji). NIE
 * używamy `me` keywordów wprost — tu chcemy bardzo wąskiego matcha pod
 * trigger personalizacji, nie pełną intent-tabelę.
 */
const PERSONALIZATION_TRIGGERS: readonly string[] = [
  'dla mnie',
  'pod mnie',
  'spersonalizow',
  'rekomend',
  'polecaj mi',
]

/**
 * Główny entry-point routera. Zwraca podzbiór nazw narzędzi do wysłania
 * do Groqa, lub `null` gdy nie ma sensownego zawężenia (orchestrator
 * wyśle wtedy pełną listę — fallback).
 *
 * Pre-warunek: caller już zdecydował że tools w ogóle są potrzebne
 * (`shouldUseTools()` zwróciło `true`). Tu już tylko zawężamy.
 */
export function routeIntent(userMessage: string): ToolName[] | null {
  const text = userMessage.toLowerCase()
  if (text.length === 0) return null

  const matched = new Set<ToolName>()

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        for (const tool of INTENT_TO_TOOLS[intent] ?? []) {
          matched.add(tool)
        }
        break
      }
    }
  }

  // Personalizacja → dorzuć get_my_user_context jako sidekick.
  for (const trigger of PERSONALIZATION_TRIGGERS) {
    if (text.includes(trigger)) {
      matched.add('get_my_user_context')
      break
    }
  }

  // Brak żadnego trafienia → fallback (cały zestaw narzędzi).
  if (matched.size === 0) return null

  // Bezpiecznik: jeśli mamy classes/briefing, dorzuć też get_my_user_context
  // (model często chce wiedzieć kto pyta zanim zwróci osobiste dane).
  // TANIE: 1 dodatkowy schemat ~50 tok vs ryzyko, że model nie spersonalizuje.
  if (
    matched.has('get_my_classes_in_range') ||
    matched.has('get_my_weekly_briefing') ||
    matched.has('get_my_aula_overview')
  ) {
    matched.add('get_my_user_context')
  }

  // Sortujemy alfabetycznie — to gwarantuje, że dwa requesty o tej samej
  // intencji wyślą tools w identycznej kolejności (prefix-stable). Groq
  // (i większość providerów) ma implicit prompt cache, który honoruje
  // identyczny prefiks: stała kolejność = wyższa szansa cached-token discount.
  return Array.from(matched).sort()
}
