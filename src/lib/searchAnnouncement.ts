import { UjverseSanitizer } from './sanitizer'
import type { AnnouncementMeta, AnnouncementStatus, UnifiedContent } from '../types/content'
import type { SearchHit } from '../types/search'

const VALID_STATUSES: ReadonlySet<AnnouncementStatus> = new Set([
  'cancelled',
  'remote',
  'duty',
  'info',
  'event',
])

function parseAnnouncementStatus(value: unknown): AnnouncementStatus {
  if (typeof value === 'string' && VALID_STATUSES.has(value as AnnouncementStatus)) {
    return value as AnnouncementStatus
  }
  return 'duty'
}

/** Mapuje hit Meilisearch na `UnifiedContent` zgodny z adapterem komunikatów. */
export function searchHitToAnnouncement(hit: SearchHit): UnifiedContent<AnnouncementMeta> {
  const author = UjverseSanitizer.cleanAuthor(hit.author) || hit.author || 'Prowadzący'
  const body = UjverseSanitizer.cleanBody(hit.content) || hit.content

  return {
    id: hit.sourceId,
    type: 'announcement',
    title: author,
    author: {
      id: `lecturer:${UjverseSanitizer.slugify(author) || hit.sourceId}`,
      displayName: author,
      subtitle: hit.department ?? null,
      avatarUrl: null,
    },
    body,
    timestamp: hit.createdAt,
    badges: [],
    metadata: {
      status: parseAnnouncementStatus(hit.announcementStatus),
      source: hit.announcementSource ?? null,
      // Pola dodane w migracji 20260715 (title/source_url/source_kind) NIE są
      // jeszcze indeksowane w Meili — search pipeline trzeba zaktualizować
      // osobno (TODO: extend `lib/searchSyncMapper.ts`). Do tego czasu wyniki
      // wyszukiwarki nie pokazują tytułu wydziałowego ani linku do oryginału.
      sourceKind: null,
      sourceUrl: null,
      title: null,
      department: hit.department ?? null,
      bodyFingerprint: null,
      summary: null,
      extractedCalendar: null,
    },
    actions: [],
  }
}
