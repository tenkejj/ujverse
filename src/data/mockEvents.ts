export interface UJEvent {
  id: string
  title: string
  date: Date
  category: string
  location: string
  description: string
  attendees: number
  isAttending?: boolean
}

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
  },
]
