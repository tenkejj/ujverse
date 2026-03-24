export const UJ_DEPARTMENTS = [
  'Wydział Zarządzania i Komunikacji Społecznej',
  'Wydział Filozoficzny',
  'Wydział Biologii',
  'Wydział Matematyki i Informatyki',
  'Wydział Prawa i Administracji',
  'Collegium Medicum – Wydział Lekarski',
  'Collegium Medicum – Wydział Farmaceutyczny',
  'Collegium Medicum – Wydział Nauk o Zdrowiu',
  'Wydział Chemii',
  'Wydział Fizyki, Astronomii i Informatyki Stosowanej',
  'Wydział Geografii i Geologii',
  'Wydział Historyczny',
  'Wydział Filologiczny',
  'Wydział Polonistyki',
  'Wydział Studiów Międzynarodowych i Politycznych',
  'Wydział Biochemii, Biofizyki i Biotechnologii',
  'Szkoła Doktorska Nauk Humanistycznych',
  'Szkoła Doktorska Nauk Ścisłych i Przyrodniczych',
] as const

export type Department = (typeof UJ_DEPARTMENTS)[number]

/** Oficjalne skróty wydziałów UJ do badge'ów i pigułek filtra. */
export const DEPT_SHORT: Record<string, string> = {
  'Wydział Zarządzania i Komunikacji Społecznej':  'WZiKS',
  'Wydział Filozoficzny':                          'WF',
  'Wydział Biologii':                              'WB',
  'Wydział Matematyki i Informatyki':              'WMiI',
  'Wydział Prawa i Administracji':                 'WPiA',
  'Collegium Medicum – Wydział Lekarski':          'CM Lek.',
  'Collegium Medicum – Wydział Farmaceutyczny':    'CM Farm.',
  'Collegium Medicum – Wydział Nauk o Zdrowiu':   'CM Zdr.',
  'Wydział Chemii':                                'WCh',
  'Wydział Fizyki, Astronomii i Informatyki Stosowanej': 'WFAiIS',
  'Wydział Geografii i Geologii':                  'WGiG',
  'Wydział Historyczny':                           'WHist.',
  'Wydział Filologiczny':                          'WFil.',
  'Wydział Polonistyki':                           'WPol.',
  'Wydział Studiów Międzynarodowych i Politycznych': 'WSMiP',
  'Wydział Biochemii, Biofizyki i Biotechnologii': 'WBBiB',
  'Szkoła Doktorska Nauk Humanistycznych':         'SDNH',
  'Szkoła Doktorska Nauk Ścisłych i Przyrodniczych': 'SDNŚiP',
}

/** Zwraca oficjalny skrót wydziału lub pełną nazwę jako fallback. */
export function getDeptAbbreviation(deptName: string): string {
  return DEPT_SHORT[deptName] ?? deptName
}
