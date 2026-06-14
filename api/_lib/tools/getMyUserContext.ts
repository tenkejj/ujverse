/**
 * Tool: `get_my_user_context`
 *
 * Zwraca asystentowi krótkie podsumowanie kim jest zalogowany użytkownik.
 * Dzięki temu model może personalizować odpowiedzi ("Cześć Franciszek,
 * widzę że jesteś na 2 roku Zarządzania w WZIKS, oto co dla Ciebie
 * istotne...") zamiast generycznych ogólników.
 *
 * Zasilane wyłącznie tabelą `profiles` (jedno SELECT). Pola brane pod uwagę:
 *   - full_name
 *   - username
 *   - study_program (kierunek studiów)
 *   - year_started (rok rozpoczęcia → wyliczamy aktualny rok studiów)
 *   - study_mode (stacjonarne / niestacjonarne / doktoranckie)
 *   - department (wydział)
 *
 * Auth: WYMAGANE — anon dostaje krótki komunikat "Musisz być zalogowany".
 * Tool ZWRACA STRING (markdown) → orchestrator `formatToolResultAsFinalAnswer`
 * przepuszcza string 1:1 do usera. Świadomie omijamy formatter switch w
 * `chat.ts` — format jest deterministyczny, sterowany tu po stronie tooli
 * (mniej rozsiania format logic po module).
 *
 * Cache TTL: 300s (dane zmieniają się rzadko — onboarding + edycja profilu;
 * 5 min daje świeżość bez wciąż-świeżego SELECT-a per request).
 */

import { registerTool, type ToolContext } from './registry.js'

const NOT_LOGGED_IN_MESSAGE =
  'Aby skorzystać z tej funkcji musisz być zalogowany w UJverse. Sprawdź profil po zalogowaniu.'

type ProfileRow = {
  full_name: string | null
  username: string | null
  study_program: string | null
  year_started: number | null
  study_mode: 'stacjonarne' | 'niestacjonarne' | 'doktoranckie' | null
  department: string | null
  bio: string | null
}

/**
 * Aktualny "rok studiów" liczony jako (bieżący rok akademicki) - (year_started) + 1.
 * Rok akademicki w PL: od 1 października. Czyli np. 1 grudnia 2026 -> rok
 * akademicki 2026/2027; user który zaczął 2025 jest na 2 roku.
 *
 * Defensive: gdy `year_started` jest > obecnego roku akademickiego, zwracamy
 * 1 (nowy user który dopiero zacznie). Nigdy nie zwracamy 0 / negative.
 */
function computeStudyYear(yearStarted: number | null): number | null {
  if (yearStarted == null) return null
  const now = new Date()
  const academicYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1
  const diff = academicYear - yearStarted + 1
  if (diff < 1) return 1
  if (diff > 10) return null // wartość poza sensownym zakresem — nie raportujemy
  return diff
}

function studyModeLabel(mode: ProfileRow['study_mode']): string | null {
  if (!mode) return null
  if (mode === 'stacjonarne') return 'studia stacjonarne'
  if (mode === 'niestacjonarne') return 'studia niestacjonarne'
  if (mode === 'doktoranckie') return 'studia doktoranckie'
  return null
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  const { data, error } = await ctx.supabaseAdmin
    .from('profiles')
    .select('full_name, username, study_program, year_started, study_mode, department, bio')
    .eq('id', ctx.userId)
    .maybeSingle()

  if (error) {
    console.error('[get_my_user_context] db error:', error.message)
    return `Nie udało mi się pobrać Twoich danych (${error.message}).`
  }
  if (!data) {
    return 'Nie znalazłem Twojego profilu. Sprawdź, czy onboarding został ukończony.'
  }

  const profile = data as ProfileRow
  const displayName =
    (profile.full_name && profile.full_name.trim()) ||
    (profile.username ? `@${profile.username}` : null) ||
    'Studentka/Student'

  const studyParts: string[] = []
  if (profile.study_program) studyParts.push(profile.study_program)
  const studyYear = computeStudyYear(profile.year_started)
  if (studyYear != null) studyParts.push(`${studyYear}. rok`)
  const modeLabel = studyModeLabel(profile.study_mode)
  if (modeLabel) studyParts.push(modeLabel)

  const sentences: string[] = []
  sentences.push(`Pamiętam — jesteś **${displayName}**.`)

  if (studyParts.length > 0 && profile.department) {
    sentences.push(
      `Studiujesz ${studyParts.join(', ')} na ${profile.department}.`,
    )
  } else if (studyParts.length > 0) {
    sentences.push(`Studiujesz ${studyParts.join(', ')}.`)
  } else if (profile.department) {
    sentences.push(`Wydział: ${profile.department}.`)
  }

  if (profile.bio && profile.bio.trim().length > 0 && profile.bio.length <= 160) {
    sentences.push(profile.bio.trim())
  }

  if (studyParts.length === 0 && !profile.department) {
    sentences.push(
      'Profil masz jeszcze pusty — uzupełnij kierunek i wydział, to dam Ci trafniejsze podpowiedzi.',
    )
  }

  const lines = [sentences.join(' ')]

  return lines.join('\n')
}

registerTool<Record<string, never>, string>({
  tool: {
    name: 'get_my_user_context',
    description:
      'Imię/kierunek/rok/wydział zalogowanego usera. Pytania „kim jestem", „co o mnie wiesz" — i ZAWSZE pierwszy przy pytaniach o personalizację.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
