/**
 * Auto-Context — niewidoczny system message wstrzykiwany na każde
 * zapytanie do Groqa. Daje modelowi „kim mówi" i „kiedy mówi"
 * BEZ wymuszania od usera typowania „cześć, jestem Franek z 2 roku WMI".
 *
 * Co wstrzykujemy:
 *  - Dzień tygodnia + data + pora dnia + godzina (zero DB hit)
 *  - Wydział, kierunek, rok studiów (1× SELECT na tabelę `profiles`,
 *    cache'owane w Vercel KV przez 5 min)
 *  - Imię (gdy `full_name` ustawione)
 *
 * Po co (vs `get_my_user_context` toolu):
 *  - Tool wymaga ŚWIADOMEGO wywołania przez model („kim jestem?"). Nie
 *    rozwiązuje problemu typu „pokaż zniżki" — model nie wie że
 *    user studiuje weganinizm i ma wpadać tylko na jedzenie.
 *  - Auto-context jest ZAWSZE — model wie, że jest 21:30 wtorku, więc
 *    „zniżka na obiad" interpretuje sensowniej („teraz już za późno na
 *    lunch — pokażę co czynne wieczorem").
 *
 * Polityka:
 *  - Krótko (≤2 zdania) — token economy. Doklejka do każdego zapytania,
 *    więc każde 50 tok kosztuje przy każdym round-tripie pętli toolowej.
 *  - Pisane „neutralnie", model NIE powtarza tego userowi 1:1.
 *  - Brak PII których user sam nie podał (rok urodzenia itd.).
 *  - Anon (brak `userId`) → tylko czas. Nie pytamy DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { kvGetSafe, kvSetSafe } from './kvCache.js'
import { formatMemoryForContext, getUserMemory } from './userMemory.js'

type CachedProfile = {
  displayName: string | null
  studyProgram: string | null
  studyYear: number | null
  department: string | null
}

const PROFILE_CACHE_TTL_SECONDS = 300

const WARSAW_CLOCK = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  weekday: 'long',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Pora dnia w PL — granice świadomie luźne, dopasowane do rytmu studenta:
 *  - 5-10 = rano (przed wykładami)
 *  - 10-13 = przed południem
 *  - 13-17 = popołudnie
 *  - 17-22 = wieczór
 *  - 22-5 = późno
 */
function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 10) return 'rano'
  if (hour >= 10 && hour < 13) return 'przed południem'
  if (hour >= 13 && hour < 17) return 'popołudnie'
  if (hour >= 17 && hour < 22) return 'wieczór'
  return 'późno'
}

/**
 * Aktualny rok studiów — taka sama logika jak `getMyUserContext` (DRY).
 * Akademicki w PL liczymy od 1 października.
 */
function computeStudyYear(yearStarted: number | null): number | null {
  if (yearStarted == null) return null
  const parts = WARSAW_CLOCK.formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const academicYear = month >= 10 ? year : year - 1
  const diff = academicYear - yearStarted + 1
  if (diff < 1) return 1
  if (diff > 10) return null
  return diff
}

/**
 * Pobiera profil z KV (cache 5 min) lub z Supabase. Fail-open — gdy KV
 * lub DB padnie, zwraca `null` i auto-context po prostu nie ma profilu
 * (dalej działa z czasem/datą).
 */
async function getProfileCached(
  userId: string,
  admin: SupabaseClient,
): Promise<CachedProfile | null> {
  const cacheKey = `auto_ctx:profile:${userId}`
  const cached = await kvGetSafe<CachedProfile>(cacheKey)
  if (cached) return cached

  const { data, error } = await admin
    .from('profiles')
    .select('full_name, username, study_program, year_started, department')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.warn('[AutoContext] profile fetch error:', error.message)
    }
    return null
  }

  const profile: CachedProfile = {
    displayName:
      (data.full_name && data.full_name.trim()) ||
      (data.username ? `@${data.username}` : null),
    studyProgram: data.study_program ?? null,
    studyYear: computeStudyYear(data.year_started ?? null),
    department: data.department ?? null,
  }

  void kvSetSafe(cacheKey, profile, PROFILE_CACHE_TTL_SECONDS)
  return profile
}

/**
 * Buduje krótki kontekst „kto/kiedy" jako string. ZAWSZE zwraca niepusty
 * string (przynajmniej fragment z czasem). Idzie do `system`-roli na końcu
 * persona-prompt'u, więc model traktuje to jak doklejkę do swojej tożsamości.
 *
 * Format (przykłady):
 *   „Dziś: wtorek, 16.06.2026, wieczór (21:30)."
 *   „Dziś: wtorek, 16.06.2026, popołudnie (14:30). Rozmawiasz z Frankiem,
 *    Informatyka 2. rok, WMI."
 */
export async function buildAutoContext(
  userId: string | null,
  admin: SupabaseClient,
): Promise<string> {
  const now = new Date()
  const clock = WARSAW_CLOCK.formatToParts(now)
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    clock.find((part) => part.type === type)?.value ?? ''
  const dayName = partValue('weekday')
  const dateStr = `${partValue('day')}.${partValue('month')}.${partValue('year')}`
  const hour = Number(partValue('hour'))
  const hourStr = `${partValue('hour')}:${partValue('minute')}`
  const part = partOfDay(hour)

  const parts: string[] = []
  parts.push(`Dziś: ${dayName}, ${dateStr}, ${part} (${hourStr}).`)

  if (userId) {
    // Profil + memory rownolegle - oba czytaja KV, oba nullable.
    const [profile, memory] = await Promise.all([
      getProfileCached(userId, admin),
      getUserMemory(userId),
    ])

    if (profile) {
      const studyBits: string[] = []
      if (profile.studyProgram) studyBits.push(profile.studyProgram)
      if (profile.studyYear != null) studyBits.push(`${profile.studyYear}. rok`)
      if (profile.department) studyBits.push(profile.department)

      if (profile.displayName && studyBits.length > 0) {
        parts.push(
          `Rozmawiasz z ${profile.displayName} (${studyBits.join(', ')}).`,
        )
      } else if (profile.displayName) {
        parts.push(`Rozmawiasz z ${profile.displayName}.`)
      } else if (studyBits.length > 0) {
        parts.push(`User: ${studyBits.join(', ')}.`)
      }
    }

    // Memory: krotka linia "Pamietasz: X; Y; Z." gdy mamy zebrane preferencje.
    // Pusty string gdy brak factow - skip bez puchniecia auto-contextu.
    const memoryLine = formatMemoryForContext(memory)
    if (memoryLine) {
      parts.push(memoryLine)
    }
  }

  return parts.join(' ')
}
