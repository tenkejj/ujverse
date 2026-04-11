import type { UJEvent } from './mockEvents'

/**
 * Szablony stałych wydarzeń oficjalnych (daty ustawiane względem „dzisiaj” przy fallbacku).
 * Gwarantują pełną sekcję „Oficjalne” przy awarii sieci / DNS.
 */
export type OfficialFallbackBlueprint = {
  slug: string
  /** Dni od dzisiejszej daty (kalendarz lokalny), godz. 12:00 */
  dayOffset: number
  title: string
  description: string
  location: string
  faculty: 'WZiKS' | 'Uniwersytet Jagielloński'
  source_name: string
  event_url: string
  imageUrl: string
}

export const OFFICIAL_FALLBACK_EVENTS: readonly OfficialFallbackBlueprint[] = [
  {
    slug: 'gala-absolwentow',
    dayOffset: 5,
    title: 'Gala Absolwentów Uniwersytetu Jagiellońskiego',
    description:
      'Uroczyste wręczenie dyplomów, spotkanie środowiska akademickiego i celebracja osiągnięć absolwentów. Śledź komunikaty na stronie wiadomości UJ — terminy i lokalizacja zależą od roku akademickiego.',
    location: 'Aula UJ / Collegium Novum, Kraków',
    faculty: 'Uniwersytet Jagielloński',
    source_name: 'Uniwersytet Jagielloński',
    event_url: 'https://www.uj.edu.pl/wiadomosci',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=85',
  },
  {
    slug: 'festiwal-nauki',
    dayOffset: 12,
    title: 'Festiwal Nauki UJ',
    description:
      'Wykłady otwarte, pokazy laboratoryjne i warsztaty dla studentów oraz mieszkańców Krakowa. Wstęp na wybrane bloki po rejestracji — szczegóły w kalendarzu wydarzeń uczelni.',
    location: 'Kampus 600-lecia i wybrane wydziały UJ',
    faculty: 'Uniwersytet Jagielloński',
    source_name: 'Uniwersytet Jagielloński',
    event_url: 'https://www.uj.edu.pl/wiadomosci/kalendarz',
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&q=85',
  },
  {
    slug: 'dzien-otwarty-wziks',
    dayOffset: 18,
    title: 'Dzień Otwarty WZiKS',
    description:
      'Prezentacja kierunków zarządzania i komunikacji społecznej, spotkania z wykładowcami i studentami, zwiedzanie wydziału. Idealny start przed rekrutacją.',
    location: 'Wydział Zarządzania i Komunikacji Społecznej UJ, Kraków',
    faculty: 'WZiKS',
    source_name: 'WZiKS UJ',
    event_url: 'https://wziks.uj.edu.pl/wiadomosci/aktualnosci',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=85',
  },
  {
    slug: 'kongres-badawczy',
    dayOffset: 25,
    title: 'Kongres Naukowy UJ — sesje plenarne',
    description:
      'Prezentacja wybranych projektów badawczych i panel dyskusyjny z udziałem zaproszonych gości. Program publikowany w wiadomościach na uj.edu.pl.',
    location: 'Uniwersytet Jagielloński, Kraków',
    faculty: 'Uniwersytet Jagielloński',
    source_name: 'Uniwersytet Jagielloński',
    event_url: 'https://www.uj.edu.pl/wiadomosci',
    imageUrl: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=85',
  },
  {
    slug: 'rekrutacja-informacja',
    dayOffset: 33,
    title: 'Rekrutacja na studia — spotkanie informacyjne',
    description:
      'Zasady rekrutacji, terminy, dokumenty i ścieżki kształcenia na UJ. Najświeższe ogłoszenia i harmonogramy w oficjalnym kanale rekrutacyjnym uczelni.',
    location: 'Online + wybrane sale wykładowe UJ',
    faculty: 'Uniwersytet Jagielloński',
    source_name: 'Biuro Rekrutacji UJ',
    event_url: 'https://rekrutacja.uj.edu.pl',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=85',
  },
  {
    slug: 'swieto-uniwersytetu',
    dayOffset: 40,
    title: 'Święto Uniwersytetu Jagiellońskiego',
    description:
      'Obchody tradycji i jubileuszy akademickich: uroczystości, koncerty i wydarzenia otwarte dla społeczności UJ. Szczegóły w kalendarzu i aktualnościach.',
    location: 'Kraków — wybrane lokacje kampusu UJ',
    faculty: 'Uniwersytet Jagielloński',
    source_name: 'Uniwersytet Jagielloński',
    event_url: 'https://www.uj.edu.pl/wiadomosci/kalendarz',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=85',
  },
] as const

function clampDayInMonth(year: number, month: number, day: number): number {
  const last = new Date(year, month + 1, 0).getDate()
  return Math.min(day, last)
}

/** Kopie wydarzeń z datami ustawionymi względem dzisiaj (zawsze w przyszłości względem północy). */
export function materializeOfficialFallbackEvents(): UJEvent[] {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d0 = today.getDate()

  return OFFICIAL_FALLBACK_EVENTS.map((bp) => {
    const target = new Date(y, m, d0 + bp.dayOffset, 12, 0, 0, 0)
    const cy = target.getFullYear()
    const cm = target.getMonth()
    const cd = clampDayInMonth(cy, cm, target.getDate())
    const date = new Date(cy, cm, cd, 12, 0, 0, 0)
    const prefix = bp.faculty === 'WZiKS' ? 'wziks' : 'uj'
    const external_id = `fallback:${prefix}:${bp.slug}`
    return {
      id: `ext:fallback:${bp.slug}`,
      external_id,
      title: bp.title,
      date,
      category: 'Oficjalne',
      location: bp.location,
      description: bp.description,
      attendees: 0,
      is_official: true,
      faculty: bp.faculty,
      source_name: bp.source_name,
      event_url: bp.event_url,
      imageUrl: bp.imageUrl,
      ingest_from_fallback: true,
    }
  })
}
