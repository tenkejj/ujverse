/**
 * Niezbędnik studenta — statyczna lista narzędzi (uczelnianych i UJverse).
 * Adresy uczelniane są tu jedynym źródłem prawdy (używa ich też `Niezbednik.tsx`).
 */

export const UJ_LINKS = {
  usosweb: 'https://usosweb.uj.edu.pl',
  pegaz: 'https://pegaz.uj.edu.pl',
  studentMail: 'https://outlook.office.com/mail/',
  usosRegistrations: 'https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/index',
  ujCalendar: 'https://www.uj.edu.pl/kalendarz',
} as const

export type InfoResourceIcon =
  | 'usos'
  | 'pegaz'
  | 'mail'
  | 'registrations'
  | 'calendar'
  | 'rooms'
  | 'plan'
  | 'spots'
  | 'discounts'
  | 'assistant'

export type InfoResource = {
  id: string
  label: string
  description: string
  icon: InfoResourceIcon
  /** Link zewnętrzny (uczelnia) albo ścieżka w UJverse. */
  href: string
  external: boolean
  requiresAccount: boolean
  keywords: readonly string[]
}

export const INFO_RESOURCES: readonly InfoResource[] = [
  {
    id: 'usosweb',
    label: 'USOSweb',
    description: 'Oceny, plan, rejestracje i legitymacja',
    icon: 'usos',
    href: UJ_LINKS.usosweb,
    external: true,
    requiresAccount: false,
    keywords: ['usos', 'oceny', 'indeks', 'legitymacja', 'wnioski', 'stypendium'],
  },
  {
    id: 'pegaz',
    label: 'PEGAZ',
    description: 'Platforma e-learningowa UJ',
    icon: 'pegaz',
    href: UJ_LINKS.pegaz,
    external: true,
    requiresAccount: false,
    keywords: ['moodle', 'e-learning', 'kursy', 'szkolenia', 'materialy'],
  },
  {
    id: 'poczta',
    label: 'Poczta studencka',
    description: 'Skrzynka @student.uj.edu.pl (Outlook)',
    icon: 'mail',
    href: UJ_LINKS.studentMail,
    external: true,
    requiresAccount: false,
    keywords: ['mail', 'email', 'outlook', 'office', 'skrzynka'],
  },
  {
    id: 'usos-rejestracje',
    label: 'Katalog rejestracji USOSweb',
    description: 'Oficjalna lista rejestracji na przedmioty',
    icon: 'registrations',
    href: UJ_LINKS.usosRegistrations,
    external: true,
    requiresAccount: false,
    keywords: ['rejestracja', 'zapisy', 'przedmioty', 'tury'],
  },
  {
    id: 'kalendarz-uj',
    label: 'Kalendarz wydarzeń UJ',
    description: 'Wydarzenia na stronie uj.edu.pl',
    icon: 'calendar',
    href: UJ_LINKS.ujCalendar,
    external: true,
    requiresAccount: false,
    keywords: ['wydarzenia', 'konferencje', 'wyklady', 'kalendarz'],
  },
  {
    id: 'sale',
    label: 'Znajdź salę',
    description: 'Budynki i sale UJ z dojazdem',
    icon: 'rooms',
    href: '/sale',
    external: false,
    requiresAccount: false,
    keywords: ['sala', 'budynek', 'mapa', 'dojazd', 'kampus', 'adres'],
  },
  {
    id: 'moj-plan',
    label: 'Mój plan',
    description: 'Twój plan zajęć z USOSweb (import .ics)',
    icon: 'plan',
    href: '/moj-plan',
    external: false,
    requiresAccount: true,
    keywords: ['plan', 'zajecia', 'ics', 'harmonogram', 'egzaminy'],
  },
  {
    id: 'miejsca',
    label: 'Miejsca do nauki',
    description: 'Biblioteki, czytelnie i kawiarnie w Krakowie',
    icon: 'spots',
    href: '/miejsca',
    external: false,
    requiresAccount: true,
    keywords: ['biblioteka', 'czytelnia', 'nauka', 'kawiarnia', 'cowork'],
  },
  {
    id: 'znizki',
    label: 'Zniżki studenckie',
    description: 'Couponek UJ — rabaty z legitymacją',
    icon: 'discounts',
    href: '/znizki',
    external: false,
    requiresAccount: true,
    keywords: ['znizki', 'rabaty', 'kupony', 'couponek', 'legitymacja'],
  },
  {
    id: 'asystent',
    label: 'Asystent Versuś',
    description: 'AI do pytań o komunikaty, rejestracje i wydarzenia. Bez logowania.',
    icon: 'assistant',
    href: '/chat',
    external: false,
    requiresAccount: false,
    keywords: ['ai', 'asystent', 'chat', 'pytanie', 'versus'],
  },
]

export function foldForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Wszystkie słowa zapytania muszą wystąpić w nazwie, opisie lub słowach kluczowych. */
export function searchResources(query: string, resources: readonly InfoResource[] = INFO_RESOURCES): InfoResource[] {
  const tokens = foldForSearch(query).split(' ').filter((t) => t.length > 0)
  if (tokens.length === 0) return []
  return resources.filter((resource) => {
    const haystack = foldForSearch(
      [resource.label, resource.description, ...resource.keywords].join(' '),
    )
    return tokens.every((token) => haystack.includes(token))
  })
}
