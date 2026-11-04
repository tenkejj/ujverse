/**
 * Kontrakty warstwy informacyjnej (dashboard, strony publiczne, wyszukiwarka).
 *
 * Każde pole czasowe ma jedno znaczenie — nie mieszamy daty publikacji,
 * pobrania przez UJverse i potwierdzenia w źródle.
 */
import type { AnnouncementStatus } from '../../types/content'
import type { RegistrationKind } from '../../types/usosRegistrations'

export type InfoKind = 'announcement' | 'registration' | 'event'

export type InfoAnnouncement = {
  kind: 'announcement'
  id: string
  title: string
  /** Fragment treści ze źródła (bez streszczeń AI). */
  excerpt: string
  body: string
  /** Kanoniczna nazwa wydziału lub `null`, gdy rekord jej nie ma. */
  faculty: string | null
  facultyShort: string | null
  sourceLabel: string
  /** Link do ogłoszenia albo — gdy rekord go nie ma — do listy komunikatów wydziału. */
  sourceUrl: string | null
  sourceIsListing: boolean
  status: AnnouncementStatus
  /** `announcements.created_at`: kiedy UJverse pierwszy raz pobrało komunikat (nie data publikacji). */
  addedAt: string
  /** Streszczenie AI z passu scrapera — UI musi je oznaczać jako AI. */
  summary: string | null
  lecturerName: string | null
  /** Czy warto dociągać `full_body` (Liferay / WordPress CM). */
  mayHaveFullBody: boolean
}

export type InfoRegistration = {
  kind: 'registration'
  id: string
  turaId: string
  title: string
  /** Kod rejestracji z USOSweb (np. `WF.IFA-25/26L-Kanon`), jeśli scraper go zapisał. */
  code: string | null
  unitName: string | null
  unitCode: string | null
  /** Wydział wyliczony z prefiksu kodu jednostki USOS; `null` dla jednostek ogólnouczelnianych. */
  faculty: string | null
  facultyShort: string | null
  opensAt: string
  closesAt: string | null
  /** Link do rejestracji w USOSweb (lub katalogu jednostki, gdy rekord nie ma własnego). */
  url: string | null
  registrationKind: RegistrationKind
  /** `usos_registrations.updated_at`: ostatnie potwierdzenie przez scraper USOSweb. */
  verifiedAt: string
}

export type InfoEvent = {
  kind: 'event'
  id: string
  externalId: string
  title: string
  description: string
  /** Dzień wydarzenia w strefie Europe/Warsaw (`YYYY-MM-DD`). Godzina ze scrapera nie jest wiarygodna. */
  dayKey: string
  date: string
  location: string | null
  category: string | null
  sourceName: string
  url: string | null
  /** `official_events.scraped_at`: kiedy wydarzenie ostatnio widniało na uj.edu.pl. */
  seenAt: string | null
}

export type InfoItem = InfoAnnouncement | InfoRegistration | InfoEvent

export type DomainFreshness = {
  /** Najnowszy znacznik czasu w danej domenie (znaczenie zależy od domeny — patrz typy wyżej). */
  latest: string | null
}

export type DomainResult<T> = {
  items: T[]
  /** Kiedy przeglądarka pobrała dane (do komunikatu „pobrano przed chwilą"). */
  fetchedAt: string
  freshness: DomainFreshness
}
