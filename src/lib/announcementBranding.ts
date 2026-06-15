/**
 * UJverse — branding / etykiety źródeł komunikatów akademickich.
 *
 * Uniwersalny helper dla 16 sourców (12 Liferay UJ + 3 WP CM + 1 ISI Drupal)
 * obsługiwanych przez `api/scrape-faculty-announcements.ts`. Każde źródło
 * ma własny `source_label` w `api/_lib/scrapers/sources.ts` — przekazujemy
 * go 1:1 do UI jako badge na karcie komunikatu.
 *
 * Historycznie istniał tylko stały badge „ISI UJ" (pre-2026-07-15), dlatego
 * niżej zachowujemy nazwy stałych `ACADEMIC_ISI_BADGE_*` jako wskazówkę
 * dla istniejących callerów. Nowy kod powinien używać `getAnnouncementBadge`.
 */

/** Backward-compat: domyślna etykieta dla legacy wpisów bez `source`. */
export const ACADEMIC_ISI_BADGE_LABEL = 'ISI UJ'
export const ACADEMIC_ISI_BADGE_TITLE = 'Źródło: ISI UJ'

/**
 * Zwraca strukturę badge'a dla danego źródła komunikatu albo `null` gdy
 * nie ma sensu nic pokazywać (np. ręczny wpis bez metadanych).
 *
 * `source` to czytelna nazwa portalu z `announcements.source`
 * (np. „ISI UJ", „Portal WPiA UJ", „Portal WL UJ CM"). Jeśli null —
 * zakładamy legacy ISI (zgodność z `showAcademicIsiBadge`).
 */
export function getAnnouncementBadge(
  source: string | null | undefined,
): { label: string; title: string } | null {
  const trimmed = source?.trim() ?? ''
  if (trimmed.length === 0) {
    return { label: ACADEMIC_ISI_BADGE_LABEL, title: ACADEMIC_ISI_BADGE_TITLE }
  }
  return { label: trimmed, title: `Źródło: ${trimmed}` }
}

/**
 * Czy w ogóle pokazywać badge źródła — w obecnej implementacji ZAWSZE
 * (każdy komunikat ma identyfikowalne źródło — patrz `FACULTY_SOURCES`),
 * ale zachowujemy nazwę jako legacy API dla istniejących callerów w
 * `AnnouncementCard` / `AnnouncementDrawer`.
 *
 * @deprecated Używaj `getAnnouncementBadge(source) != null`.
 */
export function showAcademicIsiBadge(_source: string | null | undefined): boolean {
  return true
}
