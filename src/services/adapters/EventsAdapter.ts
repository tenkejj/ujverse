import type { UJEvent } from '../../data/mockEvents'
import { UjverseSanitizer } from '../../lib/sanitizer'
import type { EventMeta, UnifiedContent } from '../../types/content'
import type { ContentAdapter } from './BaseAdapter'

/**
 * Adapter wydarzeń.
 *
 * Źródło: `useEvents` (context) + EventIngestor. Adapter odpowiada tylko za
 * tłumaczenie `UJEvent` -> `UnifiedContent<EventMeta>` — stan i mutacje
 * (toggleRsvp, addEvent) zostają w kontekście.
 */
class EventsAdapterImpl implements ContentAdapter<UJEvent, EventMeta> {
  readonly type = 'event' as const

  toUnified(raw: UJEvent): UnifiedContent<EventMeta> | null {
    if (!raw.id || !raw.title) return null
    const title = UjverseSanitizer.normalizeTypography(raw.title)
    const body = UjverseSanitizer.cleanBody(raw.description)
    const isOfficial = Boolean(raw.is_official)

    const authorSubtitle = raw.faculty ?? raw.source_name ?? null

    const actions: UnifiedContent<EventMeta>['actions'] = []
    if (raw.event_url) {
      actions.push({
        id: 'event-source',
        label: 'Strona wydarzenia',
        kind: 'link',
        href: raw.event_url,
      })
    }
    if (raw.mapUrl) {
      actions.push({ id: 'event-map', label: 'Mapa', kind: 'link', href: raw.mapUrl })
    }

    return {
      id: raw.id,
      type: 'event',
      title,
      author: {
        id: `event:${raw.id}`,
        displayName: isOfficial ? (raw.source_name ?? 'Uniwersytet Jagielloński') : 'Użytkownik',
        subtitle: authorSubtitle,
        avatarUrl: null,
      },
      body,
      timestamp: raw.date instanceof Date ? raw.date.toISOString() : null,
      badges: isOfficial
        ? [
            {
              label: raw.faculty === 'WZiKS' ? 'WZiKS' : 'UJ',
              tone: 'gold',
              title: raw.source_name ?? undefined,
            },
          ]
        : [],
      metadata: {
        date: raw.date instanceof Date ? raw.date.toISOString() : new Date().toISOString(),
        location: raw.location,
        category: raw.category,
        isOfficial,
        faculty: raw.faculty ?? null,
        imageUrl: raw.imageUrl ?? null,
        attendees: raw.attendees,
        isAttending: raw.isAttending,
        externalId: raw.external_id ?? null,
        sourceName: raw.source_name ?? null,
        eventUrl: raw.event_url ?? null,
        mapUrl: raw.mapUrl ?? null,
        attendeeAvatars: raw.attendeeAvatars,
        ingestFromFallback: raw.ingest_from_fallback,
      },
      actions,
    }
  }

  toUnifiedList(events: UJEvent[]): UnifiedContent<EventMeta>[] {
    const out: UnifiedContent<EventMeta>[] = []
    for (const e of events) {
      const uc = this.toUnified(e)
      if (uc) out.push(uc)
    }
    return out
  }
}

export const EventsAdapter = new EventsAdapterImpl()
