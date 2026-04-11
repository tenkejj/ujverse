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

/** Zwraca oficjalny skrót wydziału lub pełną nazwę jako fallback. */
export function getDeptAbbreviation(deptName: string): string {
  return DEPT_SHORT[deptName] ?? deptName
}
