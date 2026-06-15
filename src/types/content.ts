/**
 * UnifiedContent — wspólny kontrakt dla każdego elementu dashboardu (Post, Klub,
 * Komunikat, Wydarzenie). UI dostaje tylko ten kształt; rzeczywiste źródło danych
 * (Supabase, scraper, fallback JSON) jest ukryte za adapterami w `src/services`.
 */

export type ContentType = 'announcement' | 'club' | 'post' | 'event'

/** Ton wizualny odznak/etykiet — mapowany przez design system na konkretne klasy. */
export type ContentTone = 'gold' | 'green' | 'red' | 'blue' | 'neutral'

/** Akcja na karcie (link zewnętrzny lub intent obsługiwany przez konsumenta UI). */
export type ContentAction = {
  id: string
  label: string
  kind: 'link' | 'primary' | 'ghost' | 'danger'
  /** Gdy akcja jest linkiem zewnętrznym / wewnętrznym. */
  href?: string
  /** Sygnał semantyczny dla konsumenta (np. 'open-event-modal', 'toggle-like'). */
  intent?: string
  meta?: Record<string, unknown>
}

export type ContentAuthor = {
  id: string
  /** Nazwa po `UjverseSanitizer.cleanAuthor` — bez tytułów odmienionych, bez strzałek. */
  displayName: string
  /** Podpis uzupełniający (np. wydział, rola). */
  subtitle?: string | null
  avatarUrl?: string | null
}

export type ContentBadge = {
  label: string
  tone: ContentTone
  title?: string
}

/**
 * Generyczny kontrakt kontenera treści.
 * `TMeta` jest typowane per rodzaj treści w sekcji `*Meta` niżej.
 */
export interface UnifiedContent<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Stabilny identyfikator (nigdy index tablicy). */
  id: string
  type: ContentType
  /** Po sanityzacji. Pusty string dopuszczalny tylko dla typów bez tytułu. */
  title: string
  author: ContentAuthor
  /** Po sanityzacji — bez markupu LLM / HTML. */
  body: string
  /** ISO 8601 lub `null` jeśli element jest ponadczasowy (np. klub naukowy). */
  timestamp: string | null
  badges?: ContentBadge[]
  metadata: TMeta
  actions: ContentAction[]
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Typowane metadane per rodzaj treści                                         */
/* ──────────────────────────────────────────────────────────────────────────── */

/**
 * Pięć statusów komunikatu — mapuje 1:1 na CHECK constraint w migracji
 * `20260715120000_announcements_multi_faculty.sql`.
 *
 *   - `cancelled` / `remote` / `duty` — lecturer-level (źródło: ISI UJ Drupal)
 *   - `info` / `event` — komunikaty wydziałowe ogólne (Liferay UJ + WordPress
 *     Collegium Medicum)
 *
 * Jeśli dodasz nowy status, PAMIĘTAJ żeby zaktualizować:
 *   - `announcementStatusStyles.ts` (LABEL / DOT / BADGE)
 *   - `AnnouncementPills.tsx::STATUS_DOT` (Record wymusi)
 *   - `parseRow` w `AnnouncementsAdapter` (whitelisting)
 *   - Migrację SQL z CHECK constraint
 */
export type AnnouncementStatus = 'cancelled' | 'remote' | 'duty' | 'info' | 'event'

/**
 * Z którego parsera/portalu pochodzi komunikat. Mapuje 1:1 na CHECK na
 * `announcements.source_kind`.
 *
 *   - `isi_drupal`   — WZiKS via ISI UJ (lecturer-level absences)
 *   - `liferay`      — 12 wydziałów na portalu Liferay UJ (komunikaty wydziałowe)
 *   - `wordpress_cm` — 3 wydziały Collegium Medicum (WordPress)
 *   - `manual`       — wpis ręczny (admin), zarezerwowane na przyszłość
 */
export type AnnouncementSourceKind = 'isi_drupal' | 'liferay' | 'wordpress_cm' | 'manual'

export type AnnouncementMeta = {
  status: AnnouncementStatus
  source: string | null
  /** Z którego parsera pochodzi (`announcements.source_kind`). `null` dla legacy wpisów. */
  sourceKind: AnnouncementSourceKind | null
  /**
   * Deep-link do oryginalnego ogłoszenia na stronie wydziału (Liferay / WP).
   * `null` dla ISI Drupal (lecturer-blocks nie mają osobnego URL).
   */
  sourceUrl: string | null
  /**
   * Tytuł komunikatu wyciągnięty przez parser (Liferay / WP). `null` dla
   * ISI Drupal — wtedy UI używa pierwszych ~80 znaków `body`.
   */
  title: string | null
  department: string | null
  /** Stabilny fallback dla klucza React (fingerprint treści). */
  bodyFingerprint: string | null
  /**
   * AI TL;DR generowane przez Bielika w drugim passie scrapera (PR #8b).
   * Jedno zdanie po polsku, ≤ 280 znaków (CHECK na DB pilnuje 400 z marginesem).
   * `null` = ekstrakcja jeszcze nie poszła LUB LLM nie wygenerował summary
   * (np. body za krótkie). UI ukrywa sekcję jeśli null/empty.
   */
  summary: string | null
  /**
   * Wyciągnięte przez Bielika dane temporalne (PR #4). Jeśli niepuste —
   * UI renderuje badge „Pokaż w kalendarzu" deep-linkujący do widoku
   * kalendarza w `/events`. Karta `calendar_entries` syncuje się przez
   * trigger DB, tu trzymamy snapshot do natychmiastowego renderowania
   * bez dodatkowego zapytania.
   */
  extractedCalendar: import('./calendar').AnnouncementExtractedCalendar | null
}

export type ClubTagTone = 'gold' | 'green' | 'red'

export type ClubMeta = {
  department: string
  tag: string
  tagTone: ClubTagTone
}

export type PostMeta = {
  imageUrl: string | null
  likeCount: number
  commentCount: number
  isLiked: boolean
  /** Oryginalny autor posta — do obsługi nawigacji po profilach. */
  authorUserId: string
  department: string | null
  /** Smart Tags — hashtagi wyciągnięte z treści (bez `#`). */
  tags: string[]
}

export type EventMeta = {
  /** ISO 8601 (z `UJEvent.date`). */
  date: string
  location: string
  category: string
  isOfficial: boolean
  faculty?: string | null
  imageUrl?: string | null
  attendees: number
  isAttending?: boolean
  externalId?: string | null
  sourceName?: string | null
  eventUrl?: string | null
  mapUrl?: string | null
  attendeeAvatars?: string[]
  ingestFromFallback?: boolean
  authorUserId?: string | null
}

/** Pomocniczy typ — lista jakiegokolwiek UnifiedContent. */
export type AnyUnifiedContent = UnifiedContent<Record<string, unknown>>
