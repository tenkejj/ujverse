/**
 * Wydziały w warstwie informacyjnej — wyłącznie na bazie `lib/departments.ts`
 * (kanoniczne nazwy, aliasy, grupy) i rejestru źródeł scrapera.
 */
import { FACULTY_SOURCES } from '../../../api/_lib/scrapers/sources'
import {
  DEPT_SHORT,
  LEGACY_TO_CANONICAL,
  UJ_DEPARTMENTS,
  canonicalDepartment,
  departmentGroup,
  type Department,
} from '../departments'

const CANONICAL = new Set<string>(UJ_DEPARTMENTS)

/**
 * Drugi segment kodu jednostki USOS (`UJ.<prefiks>.<jednostka>`) → wydział.
 *
 * Mapowanie wynika z nazw jednostek w danych USOSweb (np. wszystkie `UJ.WZ.*`
 * to instytuty WZiKS, `UJ.WFz.*` — instytuty Wydziału Filozoficznego).
 * Prefiksów, których nie widzieliśmy w danych, nie zgadujemy — jednostki
 * ogólnouczelniane (szkoły doktorskie, MISH, SMP, Studium WF CM) zostają bez wydziału.
 */
export const USOS_UNIT_FACULTY: Readonly<Record<string, Department>> = {
  WBl: 'Wydział Biologii',
  WBt: 'Wydział Biochemii, Biofizyki i Biotechnologii',
  WCh: 'Wydział Chemii',
  WF: 'Wydział Filologiczny',
  WFa: 'Wydział Farmaceutyczny',
  WFAI: 'Wydział Fizyki, Astronomii i Informatyki Stosowanej',
  WFz: 'Wydział Filozoficzny',
  WH: 'Wydział Historyczny',
  WL: 'Wydział Lekarski',
  WMI: 'Wydział Matematyki i Informatyki',
  WOZ: 'Wydział Nauk o Zdrowiu',
  WPA: 'Wydział Prawa i Administracji',
  WPl: 'Wydział Polonistyki',
  WSM: 'Wydział Studiów Międzynarodowych i Politycznych',
  WZ: 'Wydział Zarządzania i Komunikacji Społecznej',
}

export function facultyFromUsosUnitCode(code: string | null | undefined): Department | null {
  if (typeof code !== 'string') return null
  const parts = code.trim().split('.')
  if (parts.length < 2 || parts[0] !== 'UJ') return null
  return USOS_UNIT_FACULTY[parts[1]] ?? null
}

/** Kanoniczna nazwa wydziału z listy UJ albo `null` (nieznane wartości nie przechodzą). */
export function toKnownFaculty(value: string | null | undefined): Department | null {
  const canon = canonicalDepartment(value)
  return canon && CANONICAL.has(canon) ? (canon as Department) : null
}

export function facultyShortLabel(faculty: string | null | undefined): string | null {
  const canon = canonicalDepartment(faculty)
  if (!canon) return null
  return DEPT_SHORT[canon] ?? canon
}

/**
 * Czy element przypisany do `itemFaculty` dotyczy wybranego wydziału.
 * Uwzględnia grupy aliasów (np. Lekarski ↔ Lekarsko-Stomatologiczny).
 */
export function matchesFaculty(
  itemFaculty: string | null | undefined,
  selectedFaculty: string | null | undefined,
): boolean {
  if (!selectedFaculty) return true
  const item = canonicalDepartment(itemFaculty)
  if (!item) return false
  return departmentGroup(selectedFaculty).includes(item)
}

/**
 * Wartości `announcements.department` pasujące do wydziału: kanoniczne nazwy
 * z grupy aliasów + starsze zapisy (np. `WZiKS`) mapowane na te nazwy.
 */
export function facultyDbValues(faculty: string | null | undefined): string[] {
  const group = departmentGroup(faculty)
  if (group.length === 0) return []
  const legacy = Object.entries(LEGACY_TO_CANONICAL)
    .filter(([, canon]) => group.includes(canon))
    .map(([legacyName]) => legacyName)
  return [...new Set([...group, ...legacy])]
}

const LISTING_BY_FACULTY: ReadonlyMap<string, { url: string; label: string }> = (() => {
  const map = new Map<string, { url: string; label: string }>()
  for (const source of FACULTY_SOURCES) {
    for (const dept of source.faculty_departments) {
      if (!map.has(dept)) map.set(dept, { url: source.url, label: source.source_label })
    }
  }
  return map
})()

/** Strona z listą komunikatów wydziału (ta sama, którą czyta scraper). */
export function facultyListingSource(
  faculty: string | null | undefined,
): { url: string; label: string } | null {
  const canon = canonicalDepartment(faculty)
  if (!canon) return null
  return LISTING_BY_FACULTY.get(canon) ?? null
}

/** Liczba oficjalnych portali, z których pobieramy komunikaty. */
export const ANNOUNCEMENT_SOURCE_COUNT = FACULTY_SOURCES.length

export const USOS_REGISTRATION_CATALOG_URL =
  'https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/index'

export function usosUnitCatalogUrl(unitCode: string | null | undefined): string {
  if (!unitCode || !/^[A-Za-z0-9._-]+$/.test(unitCode)) return USOS_REGISTRATION_CATALOG_URL
  return `https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/rejJednostki&jed_org_kod=${encodeURIComponent(unitCode)}`
}
