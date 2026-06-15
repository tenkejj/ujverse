/**
 * UJverse — dailyBriefPrompts: persona + prompty dla "Dziś" morning brief AI.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Mirror po stronie serwera: `api/daily-brief.ts` importuje przez relative
 * `../src/lib/dailyBriefPrompts.js`. Trzymanie promptów w jednym miejscu
 * ułatwia tuning tonu (jeden plik = jedna prawda).
 *
 * Output target: 3–5 zdań markdown — krótki, konkretny, daje POCZUCIE KIERUNKU
 * na cały dzień. Pisany w drugiej osobie ("Masz dziś...", "Najważniejsze:
 * ..."). Bez kreatywnych metafor — student rano nie ma cierpliwości na poezję.
 */

export type BriefTimetableEntry = {
  /** np. "Statystyka opisowa" */
  courseName: string | null
  /** np. "wyk" / "ćw" / "lab" */
  classKind: string | null
  /** ISO start (timezone-aware). */
  startTime: string
  /** ISO end. */
  endTime: string
  /** np. "0.04 Auditorium Maximum, ul. Krupnicza 33". */
  locationLabel: string | null
  /** `true` gdy w `announcements` jest dopasowany cancel dla tych zajęć. */
  isCancelled: boolean
}

export type BriefTask = {
  title: string
  dueAt: string | null
  priority: 'low' | 'normal' | 'high'
  /** Czy `due_at` < `now` (już po terminie). */
  isOverdue: boolean
  /** np. "wyk-statystyka" — krótka lokalizacja sali (kanału). */
  channelLabel: string | null
}

export type BriefAnnouncement = {
  lecturerName: string | null
  /**
   * Union 1:1 z `AnnouncementStatus` w `types/content.ts`. Po migracji
   * 20260715 dochodzą `'info'` i `'event'` z komunikatów wydziałowych
   * (Liferay/WP) — daily brief prompt może je używać do generowania
   * podsumowań spoza lecturer-blocks (np. „nowe stypendium na WPiA").
   */
  status: 'cancelled' | 'remote' | 'duty' | 'info' | 'event'
  body: string
  /** ISO. */
  createdAt: string
  department: string | null
}

export type DailyBriefInput = {
  /** Imię usera — pierwsza linia "Cześć Franciszek". */
  firstName: string | null
  /** Lokalna data wywołania (np. "piątek, 12 czerwca 2026"). */
  todayLabel: string
  /** Dzisiejsze zajęcia uporządkowane chronologicznie. */
  classes: BriefTimetableEntry[]
  /** TOP 5 nadchodzących deadlinów (posortowane ASC po due_at). */
  tasks: BriefTask[]
  /** Najświeższe ogłoszenia ostatnie 24-48h (max 10). */
  announcements: BriefAnnouncement[]
  /**
   * Opcjonalny dodatkowy prompt usera — np. z quick-promptu "Co jutro?",
   * "Streść ogłoszenia". Doklejany do user message; model nadal trzyma się
   * `RULES`, ale fokus odpowiedzi przesuwa się na ten cel.
   */
  userPrompt?: string | null
}

const PERSONA = `Jesteś asystentem AI dla UJverse — aplikacji studentów Uniwersytetu Jagiellońskiego. Generujesz codzienny "morning brief" — krótkie podsumowanie dnia studenta. Piszesz po polsku, w drugiej osobie ("Masz dziś...", "Czeka Cię..."). Konkretnie, bez wstępu, bez "Oczywiście, oto Twój brief". Od razu do meritum.`

const RULES = `Zasady:
- Maksymalnie 5 zdań w sumie. Pierwsze zdanie = najważniejsza rzecz dziś (najbliższe zajęcia LUB najgorszy deadline LUB ważne ogłoszenie).
- Używaj markdown (boldy dla kluczowych dat/godzin/sal).
- Gdy zajęcia są ODWOŁANE — wspomnij to PIERWSZE ("Twoje X o Y odwołane.").
- Gdy deadline jest dziś lub jutro — wspomnij konkretną godzinę.
- Pomijaj puste sekcje (nie pisz "brak zadań" jeśli nie ma — po prostu pomiń).
- ZERO emoji. ZERO "Powodzenia!" / "Miłego dnia!" na końcu — kończysz na faktach.
- Gdy NIC się dziś nie dzieje (brak zajęć, brak zadań, brak ogłoszeń) — wstaw: "Dziś masz wolne. Wykorzystaj to dobrze." i nic więcej.`

const TWARDE_LIMITY = {
  MAX_CLASSES: 8,
  MAX_TASKS: 5,
  MAX_ANNOUNCEMENTS: 10,
  MAX_BODY_PER_ANNOUNCEMENT: 280,
  MAX_OUTPUT_TOKENS: 350,
} as const

export const DAILY_BRIEF_LIMITS = TWARDE_LIMITY

/** Format pojedynczego zajęcia do widoku tekstowego dla modelu. */
function fmtClass(c: BriefTimetableEntry): string {
  const start = new Date(c.startTime).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const end = new Date(c.endTime).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const kind = c.classKind ? `[${c.classKind}] ` : ''
  const name = c.courseName ?? 'Zajęcia bez nazwy'
  const loc = c.locationLabel ? ` @ ${c.locationLabel}` : ''
  const cancelled = c.isCancelled ? '  ⛔ ODWOŁANE' : ''
  return `- ${start}–${end} ${kind}${name}${loc}${cancelled}`
}

function fmtTask(t: BriefTask): string {
  const priority = t.priority === 'high' ? '[wysoki priorytet] ' : ''
  const overdue = t.isOverdue ? '  ⚠️ PO TERMINIE' : ''
  const due = t.dueAt
    ? ` (due ${new Date(t.dueAt).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`
    : ''
  const channel = t.channelLabel ? ` — sala "${t.channelLabel}"` : ''
  return `- ${priority}${t.title}${due}${channel}${overdue}`
}

function fmtAnnouncement(a: BriefAnnouncement): string {
  const statusLabel =
    a.status === 'cancelled' ? '[ODWOŁANE]' :
    a.status === 'remote' ? '[ZDALNIE]' : '[DYŻUR]'
  const author = a.lecturerName ?? 'Nieznany prowadzący'
  const body = a.body.slice(0, TWARDE_LIMITY.MAX_BODY_PER_ANNOUNCEMENT)
  const dept = a.department ? ` (${a.department})` : ''
  return `- ${statusLabel} ${author}${dept}: ${body}`
}

export function buildDailyBriefMessages(input: DailyBriefInput): Array<{
  role: 'system' | 'user'
  content: string
}> {
  const greetingHint = input.firstName ? ` Imię użytkownika: ${input.firstName}.` : ''
  const system = `${PERSONA}${greetingHint}\n\nDzień: ${input.todayLabel}.\n\n${RULES}`

  const sections: string[] = []

  if (input.classes.length > 0) {
    sections.push(
      `## Dzisiejsze zajęcia:\n${input.classes.slice(0, TWARDE_LIMITY.MAX_CLASSES).map(fmtClass).join('\n')}`,
    )
  } else {
    sections.push(`## Dzisiejsze zajęcia:\nBrak`)
  }

  if (input.tasks.length > 0) {
    sections.push(
      `## Najbliższe zadania / deadliney:\n${input.tasks.slice(0, TWARDE_LIMITY.MAX_TASKS).map(fmtTask).join('\n')}`,
    )
  }

  if (input.announcements.length > 0) {
    sections.push(
      `## Świeże ogłoszenia (ostatnie 48h):\n${input.announcements.slice(0, TWARDE_LIMITY.MAX_ANNOUNCEMENTS).map(fmtAnnouncement).join('\n')}`,
    )
  }

  const baseUser = sections.length === 0
    ? 'Brak danych dla tego dnia.'
    : sections.join('\n\n')

  const userPrompt = input.userPrompt?.trim()
  const user = userPrompt
    ? `${baseUser}\n\n---\nDodatkowe pytanie użytkownika (odpowiedź dostosuj pod to):\n${userPrompt}`
    : baseUser

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
