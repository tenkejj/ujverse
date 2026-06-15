/**
 * Mapowania enum-ów Postgres → polskie etykiety widoczne w finalnej
 * odpowiedzi. Wydzielone z `api/chat.ts` żeby `synthesizer.ts` mógł je
 * wykorzystać przy budowaniu faktów dla LLM bez `import`-u z `chat.ts`
 * (kontrolujemy granicę modułu — orchestrator → biblioteki, nigdy odwrotnie).
 */

/** Mapowanie `announcements.status` enum → polskie nazwy widoczne dla usera. */
export const ANNOUNCEMENT_STATUS_PL: Record<string, string> = {
  cancelled: 'odwołane',
  remote: 'zdalnie',
  duty: 'dyżur',
}

/** Mapowanie `calendar_entries.kind` enum (9 wartości) → polskie etykiety. */
export const CALENDAR_KIND_PL: Record<string, string> = {
  lecturer_absence: 'nieobecność wykładowcy',
  class_cancelled: 'odwołane zajęcia',
  class_remote: 'zdalne zajęcia',
  class_rescheduled: 'przeniesione zajęcia',
  duty_change: 'zmiana dyżuru',
  free_day: 'dzień wolny',
  official_event: 'wydarzenie UJ',
  community_event: 'wydarzenie społeczności',
  deadline: 'deadline',
}

/** Mapowanie `student_discounts.category` enum (10 wartości) na PL etykiety. */
export const DISCOUNT_CATEGORY_PL: Record<string, string> = {
  jedzenie: 'jedzenie',
  kawa: 'kawa',
  kultura: 'kultura',
  kino: 'kino',
  sport: 'sport',
  ksiazki: 'książki',
  uslugi: 'usługi',
  transport: 'transport',
  odziez: 'odzież',
  inne: 'inne',
}
