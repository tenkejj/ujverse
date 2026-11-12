/** A small, explicitly sourced pilot. Programme choice is never inferred from a title. */
export const STUDY_PROFILE_STORAGE_KEY = 'ujverse.studyProfile.v1'
export const STUDY_CATALOGUE_CHECKED_ON = '2026-11-11'

export type StudyDegree = 'first' | 'second'
export type PilotProgrammeId = 'epi' | 'filozofia'

export const STUDY_DEGREE_LABELS: Record<StudyDegree, string> = {
  first: 'I stopień — licencjackie',
  second: 'II stopień — magisterskie',
}

export type PilotProgramme = {
  id: PilotProgrammeId
  name: string
  faculty: string
  facultyShort: string
  mode: 'stacjonarne'
  yearsByDegree: Readonly<Record<StudyDegree, number>>
  sourceUrl: string
  studentInfoUrl: string
  checkedOn: string
}

/** Official UJ programme pages confirm faculty, mode and 3/2-year degree lengths. */
export const PILOT_PROGRAMMES: readonly PilotProgramme[] = [
  {
    id: 'epi',
    name: 'Elektroniczne przetwarzanie informacji',
    faculty: 'Wydział Zarządzania i Komunikacji Społecznej',
    facultyShort: 'WZiKS',
    mode: 'stacjonarne',
    yearsByDegree: { first: 3, second: 2 },
    sourceUrl: 'https://studia.uj.edu.pl/pl/kierunki/wziks/elektr.prze.info',
    studentInfoUrl:
      'https://isi.uj.edu.pl/pl/o-instytucie/podstawowe-informacje',
    checkedOn: STUDY_CATALOGUE_CHECKED_ON,
  },
  {
    id: 'filozofia',
    name: 'Filozofia',
    faculty: 'Wydział Filozoficzny',
    facultyShort: 'WF',
    mode: 'stacjonarne',
    yearsByDegree: { first: 3, second: 2 },
    sourceUrl: 'https://studia.uj.edu.pl/pl/kierunki/wfilz/filozofia',
    studentInfoUrl: 'https://filozofia.uj.edu.pl/',
    checkedOn: STUDY_CATALOGUE_CHECKED_ON,
  },
]

export type StudyProfile = {
  version: 1
  faculty: string | null
  programmeId: PilotProgrammeId | null
  degree: StudyDegree | null
  year: number | null
}

export const DEFAULT_STUDY_PROFILE: Readonly<StudyProfile> = Object.freeze({
  version: 1,
  faculty: null,
  programmeId: null,
  degree: null,
  year: null,
})

export function getPilotProgramme(id: unknown): PilotProgramme | null {
  return PILOT_PROGRAMMES.find((programme) => programme.id === id) ?? null
}

/** Reject a forged faculty/programme pair instead of silently using the wrong audience. */
export function parseStudyProfile(
  raw: string | null | undefined,
): StudyProfile {
  if (!raw) return { ...DEFAULT_STUDY_PROFILE }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_STUDY_PROFILE }
  }
  if (!value || typeof value !== 'object') return { ...DEFAULT_STUDY_PROFILE }
  const input = value as Record<string, unknown>
  if (input.version !== 1) return { ...DEFAULT_STUDY_PROFILE }
  const programme = getPilotProgramme(input.programmeId)
  if (!programme || input.faculty !== programme.faculty)
    return { ...DEFAULT_STUDY_PROFILE }
  const degree =
    input.degree === 'first' || input.degree === 'second' ? input.degree : null
  const year =
    degree &&
    typeof input.year === 'number' &&
    Number.isInteger(input.year) &&
    input.year >= 1 &&
    input.year <= programme.yearsByDegree[degree]
      ? input.year
      : null
  return {
    version: 1,
    faculty: programme.faculty,
    programmeId: programme.id,
    degree,
    year,
  }
}

export function withStudyProgramme(id: PilotProgrammeId | null): StudyProfile {
  const programme = getPilotProgramme(id)
  return programme
    ? {
        version: 1,
        faculty: programme.faculty,
        programmeId: programme.id,
        degree: null,
        year: null,
      }
    : { ...DEFAULT_STUDY_PROFILE }
}

export function withStudyDegree(
  profile: StudyProfile,
  degree: StudyDegree | null,
): StudyProfile {
  return parseStudyProfile(JSON.stringify({ ...profile, degree, year: null }))
}

export function withStudyYear(
  profile: StudyProfile,
  year: number | null,
): StudyProfile {
  return parseStudyProfile(JSON.stringify({ ...profile, year }))
}

export type StudyContext = {
  profile: StudyProfile
  programme: PilotProgramme | null
  /** False when the main faculty selector no longer matches this device profile. */
  active: boolean
  label: string | null
}

/** A main faculty change never silently keeps a different programme active. */
export function resolveStudyContext(
  profile: StudyProfile,
  faculty: string | null,
): StudyContext {
  const programme = getPilotProgramme(profile.programmeId)
  const active = Boolean(programme && programme.faculty === faculty)
  if (!programme || !active)
    return {
      profile: { ...DEFAULT_STUDY_PROFILE },
      programme: null,
      active: false,
      label: null,
    }
  const parts = [programme.name]
  if (profile.degree)
    parts.push(profile.degree === 'first' ? 'I stopień' : 'II stopień')
  if (profile.year) parts.push(`${profile.year}. rok`)
  return { profile, programme, active: true, label: parts.join(' · ') }
}

/** Optional editorial mapping. It is not an authorization or student-eligibility rule. */
export type VerifiedStudyAudience = {
  programmeIds: readonly PilotProgrammeId[]
  degrees?: readonly StudyDegree[]
  years?: readonly number[]
  sourceUrl: string
  checkedOn: string
}

function isOfficialSource(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname === 'uj.edu.pl' ||
        parsed.hostname.endsWith('.uj.edu.pl'))
    )
  } catch {
    return false
  }
}

/** Unmapped or incomplete data stays visible; text/title similarity is never a mapping. */
export function matchVerifiedStudyAudience(
  profile: StudyProfile,
  audience?: VerifiedStudyAudience | null,
): 'matches' | 'outside' | 'unspecified' {
  if (
    !audience ||
    !isOfficialSource(audience.sourceUrl) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(audience.checkedOn) ||
    Number.isNaN(Date.parse(audience.checkedOn)) ||
    new Date(audience.checkedOn).toISOString().slice(0, 10) !==
      audience.checkedOn ||
    !Array.isArray(audience.programmeIds) ||
    audience.programmeIds.length === 0 ||
    audience.programmeIds.some((id) => !getPilotProgramme(id)) ||
    (audience.degrees !== undefined &&
      (!Array.isArray(audience.degrees) ||
        audience.degrees.some(
          (degree) => degree !== 'first' && degree !== 'second',
        ))) ||
    (audience.years !== undefined &&
      (!Array.isArray(audience.years) ||
        audience.years.some(
          (year) => !Number.isInteger(year) || year < 1 || year > 3,
        )))
  )
    return 'unspecified'
  const programme = getPilotProgramme(profile.programmeId)
  if (!programme || profile.faculty !== programme.faculty) return 'unspecified'
  if (!audience.programmeIds.includes(programme.id)) return 'outside'
  if (audience.degrees?.length) {
    if (!profile.degree) return 'unspecified'
    if (!audience.degrees.includes(profile.degree)) return 'outside'
  }
  if (audience.years?.length) {
    if (!profile.year) return 'unspecified'
    if (!audience.years.includes(profile.year)) return 'outside'
  }
  return 'matches'
}

type StudyProfileSnapshot = { profile: StudyProfile; persistent: boolean }
const serverSnapshot: StudyProfileSnapshot = {
  profile: { ...DEFAULT_STUDY_PROFILE },
  persistent: false,
}
let snapshot: StudyProfileSnapshot | null = null
const listeners = new Set<() => void>()

function readSnapshot(): StudyProfileSnapshot {
  if (typeof window === 'undefined') return serverSnapshot
  try {
    return {
      profile: parseStudyProfile(
        window.localStorage.getItem(STUDY_PROFILE_STORAGE_KEY),
      ),
      persistent: true,
    }
  } catch {
    return { profile: { ...DEFAULT_STUDY_PROFILE }, persistent: false }
  }
}

export function getStudyProfileSnapshot(): StudyProfileSnapshot {
  if (!snapshot) snapshot = readSnapshot()
  return snapshot
}

export function getStudyProfileServerSnapshot(): StudyProfileSnapshot {
  return serverSnapshot
}

export function setStudyProfile(profile: StudyProfile): void {
  const next = parseStudyProfile(JSON.stringify(profile))
  let persistent = false
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STUDY_PROFILE_STORAGE_KEY,
        JSON.stringify(next),
      )
      persistent = true
    } catch {
      // The choice still works in this tab when browser storage is blocked.
    }
  }
  snapshot = { profile: next, persistent }
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STUDY_PROFILE_STORAGE_KEY) return
  snapshot = readSnapshot()
  for (const listener of listeners) listener()
}

export function subscribeStudyProfile(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined')
    window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage)
  }
}
