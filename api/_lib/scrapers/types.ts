/**
 * UJverse — wspólne typy dla scraperów komunikatów wydziałowych.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */

/**
 * Mapa parser-id → konkretna implementacja (Liferay/WordPress CM/ISI Drupal).
 * Trzy parsery pokrywają wszystkie 16 wydziałów UJ + Collegium Medicum:
 *   - `liferay`      — 12 wydziałów na portalu Liferay UJ (phils, wpia,
 *     historyczny, filg, polonistyka, fais, matinf, chemia, biologia, wsmip,
 *     wgig, wbbib)
 *   - `wordpress_cm` — 3 wydziały Collegium Medicum (wl, wnz, farmacja)
 *   - `isi_drupal`   — 1 wydział (WZiKS via portal ISI UJ — Drupal)
 */
export type ParserKind = 'liferay' | 'wordpress_cm' | 'isi_drupal'

/**
 * Status komunikatu zapisywany do `announcements.status`.
 * - `cancelled`/`remote`/`duty` — pochodzi z ISI (komunikaty lecturer-level)
 * - `info`/`event` — pochodzi z Liferay/WP (ogólne komunikaty wydziałowe)
 *
 * Mapuje 1:1 na CHECK constraint w migracji
 * `20260715120000_announcements_multi_faculty.sql`.
 */
export type AnnouncementStatus = 'cancelled' | 'remote' | 'duty' | 'info' | 'event'

/**
 * Wynik parsera — jeden komunikat gotowy do upsertu w `announcements`.
 *
 * Wszystkie pola optional poza `body` zostawione luźno bo każdy parser ma
 * inne możliwości:
 *   - ISI Drupal: `body` + `lecturer_name` + `status` (cancelled/remote/duty),
 *     bez `title`/`source_url`
 *   - Liferay/WP: `body` + `title` + `source_url`, `status`='info'/'event',
 *     `lecturer_name` zwykle FALLBACK_LECTURER_NAME (bo nie ma lecturer-level
 *     ogłoszeń w klasycznym sensie)
 */
export type ParsedAnnouncement = {
  /** Pełna treść komunikatu, czyszczona z white-space, bez HTML. */
  body: string
  /** Tytuł komunikatu jeśli parser go wyciąga (Liferay/WP); ISI zwraca null. */
  title: string | null
  /** Deep-link do oryginału na stronie wydziału (jeśli parser potrafi). */
  source_url: string | null
  /**
   * Imię i nazwisko wykładowcy — wyciągane regexem (ISI lecturer-block) lub
   * fallback dla komunikatów wydziałowych ogólnych.
   */
  lecturer_name: string
  status: AnnouncementStatus
  /** Nazwa wydziału (1:1 z `UJ_DEPARTMENTS` w `src/lib/departments.ts`). */
  department: string
  /** Czytelna nazwa portalu — wyświetlana w UI ("ISI UJ", "Portal WPiA UJ"…). */
  source: string
  /** Który parser stworzył wpis — debug/filter; zapisuje do `source_kind`. */
  source_kind: ParserKind
}

/**
 * Pojedyncze źródło komunikatów — jeden URL, jeden parser, jeden wydział.
 *
 * `faculty_departments` jest tablicą bo niektóre source'y aliasują kilka
 * pozycji z `UJ_DEPARTMENTS` (np. Wydział Lekarski na UJ obsługuje też
 * kierunek lekarsko-dentystyczny — historycznie "Wydział Lekarsko-
 * Stomatologiczny" — i każdy user z którymkolwiek z tych dept-name w
 * `profiles.department` ma dostać te same komunikaty).
 *
 * Pierwsza pozycja w `faculty_departments` to canonical name zapisywany
 * do `announcements.department` (auto-routing po stronie UI musi
 * porównać `profile.department` z każdą pozycją tablicy).
 */
export type FacultySource = {
  /**
   * Identyfikator źródła — używany w logach + w response endpointu.
   * Stabilny slug (bez polskich znaków), unique w `FACULTY_SOURCES`.
   */
  id: string
  /** Pełny URL do scrape'owania. */
  url: string
  parser: ParserKind
  /**
   * Lista nazw wydziałów z `UJ_DEPARTMENTS` które obsługuje to źródło.
   * Pierwsza pozycja = canonical (zapisywana do DB), reszta = alias dla
   * auto-routingu.
   */
  faculty_departments: string[]
  /** Czytelna nazwa portalu — trafia do `announcements.source`. */
  source_label: string
  /**
   * Opcjonalna flaga — jeśli `true`, parser nie generuje błędu gdy strona
   * zwraca pustą listę. Domyślnie scraper loguje warning per source.
   */
  allow_empty?: boolean
}
