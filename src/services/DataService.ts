/**
 * UJverse — DataService facade for unified content (posts/events/clubs/announcements).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
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
import { NotificationsAdapter } from './adapters/NotificationsAdapter'
import {
  LecturerSubscriptionsAdapter,
  type LecturerSuggestion,
  type LecturerSubscriptionAnnouncement,
} from './adapters/LecturerSubscriptionsAdapter'
import {
  TimetableAdapter,
  type DistinctLecturerRow,
  type ImportIcsResult,
  type TimetableEntryRow,
  type TimetableStats,
} from './adapters/TimetableAdapter'
import { BriefingAdapter } from './adapters/BriefingAdapter'
import type { WeeklyBriefingRow } from '../types/briefing'
import { CalendarAdapter } from './adapters/CalendarAdapter'
import type { Unsubscribe } from './adapters/BaseAdapter'
import type { CalendarEntry, CalendarSearchParams } from '../types/calendar'
import { departmentGroup } from '../lib/departments'

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

  /**
   * Komunikaty — Supabase, opcjonalny filtr po wydziale.
   *
   * Filter używa `departmentGroup(dept)` zamiast pojedynczego canonical,
   * żeby obsłużyć grupy wydziałów dzielące jedno źródło komunikatów
   * (np. Wydział Lekarski + Wydział Lekarsko-Stomatologiczny — scraper
   * zapisuje wszystkie pod „Wydział Lekarski", ale user z dowolnym
   * z aliasów dostanie ten sam zestaw).
   */
  async listAnnouncements(
    opts?: { department?: string },
  ): Promise<UnifiedContent<AnnouncementMeta>[]> {
    const dept = opts?.department?.trim() ?? ''
    const group = dept ? departmentGroup(dept) : undefined
    const items = await AnnouncementsAdapter.list({
      departments: group && group.length > 0 ? group : undefined,
    })

    // Bezpiecznik: niezależnie od sortowania po stronie Supabase / adaptera,
    // UnifiedContent wychodzi z DataService zawsze chronologicznie (najnowsze
    // na górze). Dzięki temu UI nie musi znać źródła danych ani implementacji.
    return items.slice().sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return dateB - dateA
    })
  }

  /** Pełna treść jednego komunikatu (z `full_body` gdy jest) — lazy przy „rozwiń”. */
  async fetchAnnouncementById(
    id: string,
  ): Promise<UnifiedContent<AnnouncementMeta> | null> {
    const row = await AnnouncementsAdapter.fetchById(id)
    if (!row) return null
    return AnnouncementsAdapter.toUnified(row)
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

  /**
   * N najnowszych postów jako `UnifiedContent<PostMeta>[]` — używane wyłącznie
   * przez warstwę AI (RAG-Lite). Enrichment (likes/comments) celowo pomijamy:
   * model nie potrzebuje liczników, a oszczędzamy round-tripów do Supabase.
   */
  async listRecentPosts(limit = 10): Promise<UnifiedContent<PostMeta>[]> {
    const posts = await PostsAdapter.listRecent(limit)
    return PostsAdapter.toUnifiedList(posts, {
      likesCountByPost: {},
      likedPostIds: {},
      commentsCountByPost: {},
    })
  }

  /* Batch fetch dla list ID — wyszukiwarka łączy hity Meili z pełnym Post[]. */
  async fetchPostsByIds(ids: ReadonlyArray<string>): Promise<Post[]> {
    return PostsAdapter.fetchByIds(ids)
  }

  /* Powiadomienia — persists read/clear przez RLS dla auth.uid(). */
  async listNotificationsForUser(
    userId: string,
    opts?: { limit?: number },
  ): ReturnType<typeof NotificationsAdapter.listForUser> {
    return NotificationsAdapter.listForUser(userId, opts?.limit ?? 50)
  }

  async markNotificationRead(userId: string, id: string) {
    return NotificationsAdapter.markRead(userId, id)
  }

  async markAllNotificationsRead(userId: string) {
    return NotificationsAdapter.markAllUnreadRead(userId)
  }

  async clearAllNotificationsForUser(userId: string) {
    return NotificationsAdapter.deleteAllForUser(userId)
  }

  /* „Mój Plan" — subskrypcje wykładowców (CRUD + autocomplete + feed). */
  async listLecturerSubscriptions(userId: string) {
    return LecturerSubscriptionsAdapter.listForUser(userId)
  }

  async subscribeLecturer(userId: string, displayName: string) {
    return LecturerSubscriptionsAdapter.subscribe(userId, displayName)
  }

  async subscribeManyLecturers(userId: string, names: readonly string[]) {
    return LecturerSubscriptionsAdapter.subscribeMany(userId, names)
  }

  async unsubscribeLecturer(userId: string, id: number) {
    return LecturerSubscriptionsAdapter.unsubscribe(userId, id)
  }

  async suggestLecturers(query: string, limit?: number): Promise<LecturerSuggestion[]> {
    return LecturerSubscriptionsAdapter.suggest(query, limit)
  }

  async listAnnouncementsForLecturerKeys(
    keys: readonly string[],
    limit?: number,
  ): Promise<LecturerSubscriptionAnnouncement[]> {
    return LecturerSubscriptionsAdapter.listAnnouncementsForKeys(keys, limit)
  }

  /* Plan zajęć (.ics / Excel / CSV z USOSweb). */
  async importTimetableIcs(userId: string, rawIcs: string): Promise<ImportIcsResult> {
    return TimetableAdapter.importIcs(userId, rawIcs)
  }

  async importTimetableSpreadsheet(userId: string, data: ArrayBuffer): Promise<ImportIcsResult> {
    return TimetableAdapter.importSpreadsheet(userId, data)
  }

  /**
   * Import bezpośrednio z URL-a „Eksport do iCalendar" z USOSweb —
   * delegujemy fetch do proxy endpointu (`/api/fetch-usos-ics`) który
   * obchodzi brak CORS na apps.usos.uj.edu.pl.
   */
  async importTimetableFromUrl(userId: string, url: string): Promise<ImportIcsResult> {
    return TimetableAdapter.importIcsFromUrl(userId, url)
  }

  async clearTimetable(userId: string) {
    return TimetableAdapter.clear(userId)
  }

  async listTimetableForRange(
    from: Date,
    to: Date,
    announcementWindowHours?: number,
  ): Promise<TimetableEntryRow[]> {
    return TimetableAdapter.listForRange(from, to, announcementWindowHours)
  }

  async timetableEntryCount(userId: string): Promise<number> {
    return TimetableAdapter.count(userId)
  }

  /** Lista unikalnych wykładowców z zaimportowanego planu (do auto-subscribe). */
  async listTimetableLecturers(userId: string): Promise<DistinctLecturerRow[]> {
    return TimetableAdapter.listDistinctLecturers(userId)
  }

  /** Stats planu dla widoku „Mój Plan" (zajęcia tygodniowo, godziny, busiest day, last import). */
  async timetableStats(userId: string, weekStart: Date, weekEnd: Date): Promise<TimetableStats> {
    return TimetableAdapter.stats(userId, weekStart, weekEnd)
  }

  /* Tygodniowy briefing — lazy generation + browsing historycznych. */
  async ensureWeeklyBriefing(weekStart?: Date) {
    return BriefingAdapter.ensure(weekStart)
  }

  async latestWeeklyBriefing(): Promise<WeeklyBriefingRow | null> {
    return BriefingAdapter.latestForCurrentUser()
  }

  async listRecentBriefings(limit?: number): Promise<WeeklyBriefingRow[]> {
    return BriefingAdapter.listRecent(limit)
  }

  async getBriefingById(briefingId: number): Promise<WeeklyBriefingRow | null> {
    return BriefingAdapter.getById(briefingId)
  }

  /* Mapowanie wydarzeń z kontekstu do UnifiedContent. */
  toUnifiedEvents(events: UJEvent[]): UnifiedContent<EventMeta>[] {
    return EventsAdapter.toUnifiedList(events)
  }

  /** Hybrydowe wyszukiwanie: Supabase (ilike) + cache oficjalnych z ingestu. */
  async searchEvents(
    query: string,
    opts?: { limit?: number; includePast?: boolean },
  ): Promise<UnifiedContent<EventMeta>[]> {
    const normalized = query.trim()
    if (normalized.length < 2) return []
    const rows = await EventsAdapter.search(normalized, opts)
    return EventsAdapter.toUnifiedList(rows)
  }

  /** Wydarzenia użytkownika z DB (profil — domyślnie z przeszłymi). */
  async fetchEventsByUserId(
    userId: string,
    opts?: { includePast?: boolean },
  ): Promise<UJEvent[]> {
    return EventsAdapter.listByUserId(userId, opts)
  }

  async fetchEventById(id: string): Promise<UJEvent | null> {
    return EventsAdapter.fetchById(id)
  }

  /* Kalendarz akademicki (calendar_entries + RPC calendar_search). */
  async listCalendarEntries(params: CalendarSearchParams): Promise<CalendarEntry[]> {
    return CalendarAdapter.listForRange(params)
  }

  subscribeCalendar(onChange: () => void): Unsubscribe {
    return CalendarAdapter.subscribe(onChange)
  }
}

export const DataService = new DataServiceImpl()
