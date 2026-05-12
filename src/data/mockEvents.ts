export interface UJEvent {
  id: string
  user_id?: string
  author?: {
    id: string
    full_name?: string | null
    username?: string | null
    avatar_url?: string | null
  }
  title: string
  date: Date
  category: string
  location: string
  description: string
  attendees: number
  isAttending?: boolean
  /** Unikalny identyfikator rekordu w zewnętrznym kalendarzu (np. UJ Calendar). */
  external_id?: string
  /** Etykieta źródła synchronizacji (np. „WPiA UJ”, „Kalendarz UJ”). */
  source_name?: string
  /** Wydarzenie promowane przez uczelnię / oficjalny kanał. */
  is_official?: boolean
  /** Link do strony źródłowej wydarzenia. */
  event_url?: string
  /** Wydział / poziom organizacyjny (np. ingest z WZiKS vs strona główna UJ). */
  faculty?: 'WZiKS' | 'Uniwersytet Jagielloński'
  /** Wpis z lokalnego zestawu awaryjnego (brak sieci / błąd proxy). */
  ingest_from_fallback?: boolean
  /** URL obrazka lub data URL (Base64) plakatu. */
  imageUrl?: string
  /** Link do mapy (np. Google Maps). */
  mapUrl?: string
  /** Miniatury awatarów uczestników. */
  attendeeAvatars?: string[]
}

const AVA = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a Date as YYYYMMDDTHHmmssZ (UTC). */
function formatGoogleCalendarUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
}

/** Builds a Google Calendar “create event” URL for the event’s calendar day (UTC midnight–23:59:59). */
export function generateGoogleCalendarLink(event: UJEvent): string {
  const y = event.date.getFullYear()
  const m = event.date.getMonth()
  const day = event.date.getDate()
  const start = new Date(Date.UTC(y, m, day, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, day, 23, 59, 59))
  const dates = `${formatGoogleCalendarUtc(start)}/${formatGoogleCalendarUtc(end)}`
  const base = 'https://calendar.google.com/calendar/render'
  return `${base}?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${encodeURIComponent(dates)}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`
}

const MONTH_LABELS_PL = [
  'Sty',
  'Lut',
  'Mar',
  'Kwi',
  'Maj',
  'Cze',
  'Lip',
  'Sie',
  'Wrz',
  'Paź',
  'Lis',
  'Gra',
] as const

export function formatEventDateParts(date: Date): { monthLabel: string; dayNum: string } {
  return {
    monthLabel: MONTH_LABELS_PL[date.getMonth()],
    dayNum: String(date.getDate()),
  }
}

export function formatEventDateLong(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' }).format(date)
}

export const mockEvents: UJEvent[] = [
  {
    id: 'juwenalia-2026',
    title: 'Juwenalia UJ 2026',
    date: new Date(2026, 4, 14),
    category: 'Wydarzenie',
    location: 'Kampus Główny UJ, Kraków',
    description:
      'Coroczny festiwal studencki z koncertami na Błoniach, integracją wydziałów i atrakcjami dla całej społeczności akademickiej. Śledź oficjalny harmonogram — występy, strefy chill i wspólne świętowanie końca roku akademickiego.',
    attendees: 124,
    imageUrl:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=Collegium+Novum+UJ+Kraków',
    attendeeAvatars: [AVA('juw-a'), AVA('juw-b'), AVA('juw-c')],
  },
  {
    id: 'dnia-wppia-2026',
    title: 'Dni Wydziału WPiA 2026',
    date: new Date(2026, 4, 22),
    category: 'Wydział',
    location: 'Wydział Prawa i Administracji UJ',
    description:
      'Spotkania z praktykami, warsztaty aplikacyjne, prezentacja kół naukowych i debaty o karierze po WPiA. Dla studentów I i II stopnia — możliwość rozmów z absolwentami i pracodawcami z sektora prawniczego.',
    attendees: 58,
    imageUrl:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=Krupnicza+33+Kraków+WPiA+UJ',
    attendeeAvatars: [AVA('wppia-1'), AVA('wppia-2'), AVA('wppia-3')],
  },
  {
    id: 'rekrutacja-2026',
    title: 'Rekrutacja 2026 – info',
    date: new Date(2026, 5, 5),
    category: 'Ogłoszenie',
    location: 'Online + sala wykładowa (Reymonta 4)',
    description:
      'Zbiór informacji o terminach, dokumentach i ścieżkach rekrutacji na studia I i II stopnia. Prezentacja kierunków, zasady punktacji i najczęstsze pytania kandydatów — także sesja Q&A na żywo.',
    attendees: 203,
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=Reymonta+4+Kraków+Uniwersytet+Jagielloński',
    attendeeAvatars: [AVA('rek-x'), AVA('rek-y'), AVA('rek-z')],
  },
  {
    id: 'noc-nauki-2026',
    title: 'Noc Nauki UJ 2026',
    date: new Date(2026, 5, 12),
    category: 'Wydarzenie',
    location: 'Kampus 600-lecia, wybrane budynki wydziałów',
    description:
      'Otwarte laboratoria, pokazy doświadczeń i krótkie wykłady popularnonaukowe dla mieszkańców Krakowa i studentów. Wstęp bezpłatny po rejestracji na wybrane bloki tematyczne.',
    attendees: 412,
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=Kampus+600-lecia+UJ+Kraków',
    attendeeAvatars: [AVA('nn-1'), AVA('nn-2'), AVA('nn-3')],
  },
]
