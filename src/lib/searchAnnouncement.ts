import { UjverseSanitizer } from './sanitizer'
import type { AnnouncementMeta, AnnouncementStatus, UnifiedContent } from '../types/content'
import type { SearchHit } from '../types/search'

function parseAnnouncementStatus(value: unknown): AnnouncementStatus {
  if (value === 'cancelled' || value === 'remote' || value === 'duty') return value
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
      department: hit.department ?? null,
      bodyFingerprint: null,
      // Wyniki wyszukiwarki przychodzą z Meili (search index) — TL;DR i
      // extracted_calendar nie są jeszcze indeksowane (TODO: dodać do
      // search pipeline). Dla wyników wyszukiwania ukrywamy te elementy
      // żeby nie pokazywać starych snapshotów.
      summary: null,
      extractedCalendar: null,
    },
    actions: [],
  }
}
