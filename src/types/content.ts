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

export type AnnouncementStatus = 'cancelled' | 'remote' | 'duty'

export type AnnouncementMeta = {
  status: AnnouncementStatus
  source: string | null
  department: string | null
  /** Stabilny fallback dla klucza React (fingerprint treści). */
  bodyFingerprint: string | null
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
