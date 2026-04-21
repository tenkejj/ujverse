import type { Post } from '../types'
import type {
  AnnouncementMeta,
  ClubMeta,
  EventMeta,
  PostMeta,
  UnifiedContent,
} from '../types/content'
import type { UJEvent } from '../data/mockEvents'
import { AnnouncementsAdapter } from './adapters/AnnouncementsAdapter'
import { ClubsAdapter } from './adapters/ClubsAdapter'
import { EventsAdapter } from './adapters/EventsAdapter'
import { PostsAdapter } from './adapters/PostsAdapter'
import type { Unsubscribe } from './adapters/BaseAdapter'
import { canonicalDepartment } from '../lib/departments'

/**
 * DataService — jedyny punkt styku komponentów UI z danymi.
 *
 * UI nie ma prawa importować `supabase`, `EventIngestor` ani `src/data/*`.
 * Jeśli w przyszłości Koła przejdą na Supabase lub Events na nowe API,
 * zmiana ogranicza się do odpowiedniego adaptera.
 */
class DataServiceImpl {
  /* Koła naukowe — jednorazowe pobranie (lokalny fallback). */
  async listClubs(): Promise<UnifiedContent<ClubMeta>[]> {
    return ClubsAdapter.list()
  }

  /* Komunikaty — Supabase, opcjonalny filtr po wydziale. */
  async listAnnouncements(
    opts?: { department?: string },
  ): Promise<UnifiedContent<AnnouncementMeta>[]> {
    const items = await AnnouncementsAdapter.list()
    const dept = opts?.department?.trim() ?? ''
    const canonical = dept ? canonicalDepartment(dept) : null
    const filtered = !dept || !canonical
      ? items
      : items.filter((ann) => {
          const row = canonicalDepartment(ann.metadata.department)
          if (row == null) return true
          return row === canonical
        })

    // Bezpiecznik: niezależnie od sortowania po stronie Supabase / adaptera,
    // UnifiedContent wychodzi z DataService zawsze chronologicznie (najnowsze
    // na górze). Dzięki temu UI nie musi znać źródła danych ani implementacji.
    return filtered.slice().sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return dateB - dateA
    })
  }

  /* Realtime dla komunikatów — cb bez danych, UI zrobi refetch. */
  subscribeAnnouncements(onChange: () => void): Unsubscribe {
    return AnnouncementsAdapter.subscribe(onChange)
  }

  /**
   * Mapowanie Post[] + stan (likes/comments) -> UnifiedContent<PostMeta>[].
   *
   * Fetch samych postów pozostaje w App.tsx (tam żyje cały stan sesji/likes),
   * serwis wystawia wyłącznie pure-mapper, zgodny z kontraktem adaptera.
   */
  toUnifiedPosts(
    posts: Post[],
    enrichments: {
      likesCountByPost: Record<string, number>
      likedPostIds: Record<string, boolean>
      commentsCountByPost: Record<string, number>
    },
  ): UnifiedContent<PostMeta>[] {
    return PostsAdapter.toUnifiedList(posts, enrichments)
  }

  /* Pobranie pojedynczego posta (np. dla SinglePostView). */
  async fetchPostById(id: string): Promise<Post | null> {
    return PostsAdapter.fetchById(id)
  }

  /* Mapowanie wydarzeń z kontekstu do UnifiedContent. */
  toUnifiedEvents(events: UJEvent[]): UnifiedContent<EventMeta>[] {
    return EventsAdapter.toUnifiedList(events)
  }
}

export const DataService = new DataServiceImpl()
