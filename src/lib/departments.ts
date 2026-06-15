/** Kolejność zgodna z oficjalną listą skrótów UJ (sidebar / pigułki). */
export const UJ_DEPARTMENTS = [
  'Wydział Lekarski',
  'Wydział Lekarsko-Stomatologiczny',
  'Wydział Filozoficzny',
  'Wydział Nauk o Zdrowiu',
  'Wydział Prawa i Administracji',
  'Wydział Farmaceutyczny',
  'Wydział Historyczny',
  'Wydział Filologiczny',
  'Wydział Studiów Międzynarodowych i Politycznych',
  'Wydział Zarządzania i Komunikacji Społecznej',
  'Wydział Polonistyki',
  'Wydział Fizyki, Astronomii i Informatyki Stosowanej',
  'Wydział Matematyki i Informatyki',
  'Wydział Chemii',
  'Wydział Biologii',
  'Wydział Geografii i Geologii',
  'Wydział Biochemii, Biofizyki i Biotechnologii',
] as const

export type Department = (typeof UJ_DEPARTMENTS)[number]

const CANONICAL_SET = new Set<string>(UJ_DEPARTMENTS)

/** Stare zapisy profili / pełne nazwy → aktualny string z UJ_DEPARTMENTS. */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  'Collegium Medicum – Wydział Lekarski': 'Wydział Lekarski',
  'Collegium Medicum – Wydział Farmaceutyczny': 'Wydział Farmaceutyczny',
  'Collegium Medicum – Wydział Nauk o Zdrowiu': 'Wydział Nauk o Zdrowiu',
  /** Skrót ze scrapera ISI / importów zewnętrznych */
  WZiKS: 'Wydział Zarządzania i Komunikacji Społecznej',
}

/** Skróty dla kanonicznych nazw + aliasy legacy (wyświetlanie w UI). */
export const DEPT_SHORT: Record<string, string> = {
  'Wydział Lekarski': 'WL',
  'Wydział Lekarsko-Stomatologiczny': 'WLS',
  'Wydział Filozoficzny': 'WF',
  'Wydział Nauk o Zdrowiu': 'WNoZ',
  'Wydział Prawa i Administracji': 'WP',
  'Wydział Farmaceutyczny': 'WFz',
  'Wydział Historyczny': 'WH',
  'Wydział Filologiczny': 'WFil',
  'Wydział Studiów Międzynarodowych i Politycznych': 'WSP',
  'Wydział Zarządzania i Komunikacji Społecznej': 'WZiKS',
  'Wydział Polonistyki': 'WPol',
  'Wydział Fizyki, Astronomii i Informatyki Stosowanej': 'WFAIS',
  'Wydział Matematyki i Informatyki': 'WMI',
  'Wydział Chemii': 'WCh',
  'Wydział Biologii': 'WB',
  'Wydział Geografii i Geologii': 'WGG',
  'Wydział Biochemii, Biofizyki i Biotechnologii': 'WBBB',

  'Collegium Medicum – Wydział Lekarski': 'WL',
  'Collegium Medicum – Wydział Farmaceutyczny': 'WFz',
  'Collegium Medicum – Wydział Nauk o Zdrowiu': 'WNoZ',

  'Szkoła Doktorska Nauk Humanistycznych': 'SDNH',
  'Szkoła Doktorska Nauk Ścisłych i Przyrodniczych': 'SDNŚiP',
}

/** Zwraca kanoniczną nazwę z listy wydziałów albo null dla pustego. */
export function canonicalDepartment(stored: string | null | undefined): string | null {
  if (stored == null || !String(stored).trim()) return null
  const t = stored.trim()
  if (CANONICAL_SET.has(t)) return t as Department
  const mapped = LEGACY_TO_CANONICAL[t]
  if (mapped && CANONICAL_SET.has(mapped)) return mapped as Department
  return t
}

/**
 * Grupy wydziałów dzielących to samo źródło komunikatów (jeden portal,
 * wiele canonical nazw w `UJ_DEPARTMENTS`). Mapuje 1:1 na multi-element
 * `faculty_departments` w `api/_lib/scrapers/sources.ts`.
 *
 * Aktualnie jedyny case to Wydział Lekarski + Wydział Lekarsko-Stomatologiczny:
 * scraper zapisuje wszystkie komunikaty pod `Wydział Lekarski` (canonical),
 * ale user który ma `profile.department = 'Wydział Lekarsko-Stomatologiczny'`
 * też je powinien widzieć (na UJ jest jeden Wydział Lekarski z kierunkiem
 * lekarskim i lekarsko-dentystycznym — historyczna lista trzyma osobne wpisy).
 *
 * Klucz mapy = canonical name (po `canonicalDepartment`), wartość = lista
 * wszystkich aliasów z tej grupy (włącznie z kluczem).
 */
const DEPARTMENT_GROUPS: Record<string, readonly string[]> = {
  'Wydział Lekarski': ['Wydział Lekarski', 'Wydział Lekarsko-Stomatologiczny'],
  'Wydział Lekarsko-Stomatologiczny': ['Wydział Lekarski', 'Wydział Lekarsko-Stomatologiczny'],
}

/**
 * Zwraca listę nazw wydziałów dzielących jeden zestaw komunikatów z `name`.
 * Dla wydziałów bez aliasów zwraca tablicę z jednym elementem.
 *
 * Używane przez `DataService.listAnnouncements` do dopasowania komunikatów,
 * gdy scraper zapisuje wszystkie wpisy pod jedną canonical nazwą, ale user
 * w profilu ma alias historyczny.
 */
export function departmentGroup(name: string | null | undefined): string[] {
  const canon = canonicalDepartment(name)
  if (!canon) return []
  const group = DEPARTMENT_GROUPS[canon]
  return group ? [...group] : [canon]
}

/** Zwraca oficjalny skrót wydziału lub pełną nazwę jako fallback. */
export function getDeptAbbreviation(deptName: string): string {
  return DEPT_SHORT[deptName] ?? deptName
}

/**
 * Paleta akcentów wydziałowych — `hex` używany dla linii/indikatora/akcji,
 * `glowRgba` dla miękkich poświat (shadow, ring). Fallback (brak wydziału)
 * wraca do `brand-gold-bright`, który działa w obu motywach.
 *
 * Kolory dobrane jako dystynktywne i czytelne w light + dark mode.
 */
export type DeptAccent = { hex: string; glowRgba: string }

export const DEPT_ACCENT: Record<string, DeptAccent> = {
  'Wydział Lekarski':                                { hex: '#c42a3d', glowRgba: 'rgba(196,42,61,0.45)' },
  'Wydział Lekarsko-Stomatologiczny':                { hex: '#e07a5f', glowRgba: 'rgba(224,122,95,0.45)' },
  'Wydział Filozoficzny':                            { hex: '#7c3aed', glowRgba: 'rgba(124,58,237,0.45)' },
  'Wydział Nauk o Zdrowiu':                          { hex: '#0ea5a4', glowRgba: 'rgba(14,165,164,0.45)' },
  'Wydział Prawa i Administracji':                   { hex: '#1e3a8a', glowRgba: 'rgba(30,58,138,0.45)' },
  'Wydział Farmaceutyczny':                          { hex: '#16a34a', glowRgba: 'rgba(22,163,74,0.45)' },
  'Wydział Historyczny':                             { hex: '#92400e', glowRgba: 'rgba(146,64,14,0.45)' },
  'Wydział Filologiczny':                            { hex: '#be185d', glowRgba: 'rgba(190,24,93,0.45)' },
  'Wydział Studiów Międzynarodowych i Politycznych': { hex: '#0369a1', glowRgba: 'rgba(3,105,161,0.45)' },
  'Wydział Zarządzania i Komunikacji Społecznej':    { hex: '#f59e0b', glowRgba: 'rgba(245,158,11,0.45)' },
  'Wydział Polonistyki':                             { hex: '#a16207', glowRgba: 'rgba(161,98,7,0.45)' },
  'Wydział Fizyki, Astronomii i Informatyki Stosowanej': { hex: '#0284c7', glowRgba: 'rgba(2,132,199,0.45)' },
  'Wydział Matematyki i Informatyki':                { hex: '#4f46e5', glowRgba: 'rgba(79,70,229,0.45)' },
  'Wydział Chemii':                                  { hex: '#059669', glowRgba: 'rgba(5,150,105,0.45)' },
  'Wydział Biologii':                                { hex: '#65a30d', glowRgba: 'rgba(101,163,13,0.45)' },
  'Wydział Geografii i Geologii':                    { hex: '#b45309', glowRgba: 'rgba(180,83,9,0.45)' },
  'Wydział Biochemii, Biofizyki i Biotechnologii':   { hex: '#db2777', glowRgba: 'rgba(219,39,119,0.45)' },
}

export const DEFAULT_DEPT_ACCENT: DeptAccent = {
  hex: '#e8c84a',
  glowRgba: 'rgba(232,200,74,0.4)',
}

/** Zwraca akcent wydziału (kanonizuje nazwę) lub fallback brand-gold-bright. */
export function getDeptAccent(deptName: string | null | undefined): DeptAccent {
  const canon = canonicalDepartment(deptName)
  if (canon && DEPT_ACCENT[canon]) return DEPT_ACCENT[canon]
  return DEFAULT_DEPT_ACCENT
}
