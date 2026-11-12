/**
 * Lokalne preferencje warstwy informacyjnej (bez konta).
 *
 * Wersjonowany JSON w `localStorage`. Odczyt jest defensywny: nieznany
 * wydział lub uszkodzony wpis = brak wyboru, nigdy wyjątek.
 */
import { toKnownFaculty } from './faculty'

export const INFO_PREFS_STORAGE_KEY = 'ujverse.infoPrefs.v1'

export const DASHBOARD_SECTIONS = ['announcements', 'registrations', 'events', 'tools'] as const
export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]

export type FacultyChoice = {
  /** `null` = świadomie wybrany „Cały UJ". */
  value: string | null
  /** Id zalogowanego użytkownika, który dokonał wyboru; `null` = wybór bez konta. */
  setBy: string | null
  updatedAt: string
}

export type InfoPrefs = {
  version: 1
  /** `null` = użytkownik jeszcze niczego nie wybrał na tym urządzeniu. */
  faculty: FacultyChoice | null
  hiddenSections: DashboardSectionId[]
}

export const DEFAULT_INFO_PREFS: InfoPrefs = Object.freeze({
  version: 1,
  faculty: null,
  hiddenSections: [],
}) as InfoPrefs

const SECTION_SET = new Set<string>(DASHBOARD_SECTIONS)

function parseFacultyChoice(raw: unknown): FacultyChoice | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const setBy = typeof o.setBy === 'string' && o.setBy.length > 0 ? o.setBy : null
  const updatedAt =
    typeof o.updatedAt === 'string' && !Number.isNaN(Date.parse(o.updatedAt))
      ? o.updatedAt
      : new Date(0).toISOString()
  if (o.value === null) return { value: null, setBy, updatedAt }
  if (typeof o.value !== 'string') return null
  const faculty = toKnownFaculty(o.value)
  return faculty ? { value: faculty, setBy, updatedAt } : null
}

export function parseInfoPrefs(raw: string | null | undefined): InfoPrefs {
  if (!raw) return DEFAULT_INFO_PREFS
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_INFO_PREFS
  }
  if (!parsed || typeof parsed !== 'object') return DEFAULT_INFO_PREFS
  const o = parsed as Record<string, unknown>
  if (o.version !== 1) return DEFAULT_INFO_PREFS
  const hidden = Array.isArray(o.hiddenSections)
    ? [...new Set(o.hiddenSections.filter((s): s is DashboardSectionId => typeof s === 'string' && SECTION_SET.has(s)))]
    : []
  return { version: 1, faculty: parseFacultyChoice(o.faculty), hiddenSections: hidden }
}

export function serializeInfoPrefs(prefs: InfoPrefs): string {
  return JSON.stringify(prefs)
}

export type FacultySource = 'device' | 'profile' | 'none'

export type FacultyResolution = {
  faculty: string | null
  source: FacultySource
}

/**
 * Kolejność (deterministyczna):
 *   1. zalogowany + wybór zapisany przez tego samego użytkownika → wybór z urządzenia,
 *   2. zalogowany + wydział w profilu → profil,
 *   3. dowolny zapisany wybór (także „Cały UJ") → wybór z urządzenia,
 *   4. nic → cały UJ.
 * Lokalny wybór nigdy nie nadpisuje profilu — tylko go przesłania na tym urządzeniu.
 */
export function resolveFaculty(input: {
  prefs: InfoPrefs
  sessionUserId: string | null
  profileDepartment: string | null | undefined
}): FacultyResolution {
  const stored = input.prefs.faculty
  if (input.sessionUserId) {
    if (stored && stored.setBy === input.sessionUserId) {
      return { faculty: stored.value, source: 'device' }
    }
    const profileFaculty = toKnownFaculty(input.profileDepartment)
    if (profileFaculty) return { faculty: profileFaculty, source: 'profile' }
  }
  if (stored) return { faculty: stored.value, source: 'device' }
  return { faculty: null, source: 'none' }
}

export function withFacultyChoice(
  prefs: InfoPrefs,
  faculty: string | null,
  userId: string | null,
  now: Date = new Date(),
): InfoPrefs {
  const value = faculty === null ? null : toKnownFaculty(faculty)
  if (faculty !== null && value === null) return prefs
  return {
    ...prefs,
    faculty: { value, setBy: userId, updatedAt: now.toISOString() },
  }
}

export function withSectionHidden(
  prefs: InfoPrefs,
  section: DashboardSectionId,
  hidden: boolean,
): InfoPrefs {
  const set = new Set(prefs.hiddenSections)
  if (hidden) set.add(section)
  else set.delete(section)
  return { ...prefs, hiddenSections: DASHBOARD_SECTIONS.filter((s) => set.has(s)) }
}
