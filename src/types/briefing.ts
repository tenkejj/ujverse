/**
 * UJverse — typy payloadu tygodniowego briefingu.
 *
 * Soft contract z `compute_weekly_briefing(uuid, date)` (migracja
 * 20260622100000_weekly_briefings.sql). `schema_version` w payloadzie
 * pozwala migrować odbiorcę w przyszłości bez crashy na starych wierszach.
 */

export type BriefingClassRef = {
  summary: string
  start_time: string
  end_time: string
  location: string | null
  lecturer_name: string | null
}

export type BriefingClassesSummary = {
  total: number
  /** Sumaryczne godziny zajęć w tygodniu (NUMERIC z bazy → number po cast). */
  hours: number
  days_with_classes: number
  /** Liczba zajęć z aktywnym komunikatem o odwołaniu od pasującego wykładowcy. */
  cancelled: number
  first: BriefingClassRef | null
  last: BriefingClassRef | null
}

export type BriefingChange = {
  id: string
  kind:
    | 'lecturer_absence'
    | 'class_cancelled'
    | 'class_remote'
    | 'class_rescheduled'
    | 'duty_change'
  title: string
  description: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string | null
  lecturer_name: string | null
  source_announcement_id: string | null
}

export type BriefingAnnouncement = {
  id: string
  lecturer_name: string
  body: string
  /** Union 1:1 z `AnnouncementStatus` w `types/content.ts` (po migracji 20260715). */
  status: 'cancelled' | 'remote' | 'duty' | 'info' | 'event'
  department: string | null
  created_at: string
}

export type BriefingOfficialEvent = {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string | null
  department: string | null
  source_official_event_id: string | null
}

export type BriefingNextExam = {
  id: string
  title: string
  starts_at: string
  location: string | null
  /** Liczba dni od `week_start` do `starts_at` (zaokrąglone w dół, ≥ 0). */
  days_away: number
} | null

export type WeeklyBriefingPayload = {
  schema_version: 1
  /** ISO date — poniedziałek tygodnia (Europe/Warsaw, lokalna). */
  week_start: string
  /** ISO date — niedziela tygodnia. */
  week_end: string
  classes: BriefingClassesSummary
  changes: BriefingChange[]
  announcements_from_subscribed: BriefingAnnouncement[]
  official_events: BriefingOfficialEvent[]
  next_exam: BriefingNextExam
}

export type WeeklyBriefingRow = {
  id: number
  user_id: string
  week_start: string
  payload: WeeklyBriefingPayload
  generated_at: string
}
