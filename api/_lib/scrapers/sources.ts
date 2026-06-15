/**
 * UJverse — lista źródeł komunikatów wszystkich 16 wydziałów UJ.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Każde źródło ma: URL, parser type, listę wydziałów które obsługuje
 * (alias na canonical name z `src/lib/departments.ts`).
 *
 * Mapowanie URL → parser:
 *   - 12 wydziałów na portalu Liferay UJ (subdomeny .uj.edu.pl)
 *   - 3 wydziały Collegium Medicum na WordPress (subdomeny .cm.uj.edu.pl)
 *   - 1 wydział (WZiKS) na portalu ISI UJ (Drupal-based)
 *
 * `faculty_departments`:
 *   Pierwsza pozycja jest CANONICAL — zapisywana do
 *   `announcements.department`. Reszta to aliasy — używane przez UI/
 *   auto-routing żeby user z `profiles.department` = którykolwiek z
 *   tych nazw dostał komunikaty z tego źródła.
 *
 *   Aktualnie jedyny alias to "Wydział Lekarsko-Stomatologiczny" →
 *   Wydział Lekarski (na UJ jest jeden Wydział Lekarski obsługujący
 *   kierunek lekarski i lekarsko-dentystyczny, ale w `UJ_DEPARTMENTS`
 *   są jako dwa wpisy z powodów historycznych).
 */
import type { FacultySource } from './types.js'

export const FACULTY_SOURCES: FacultySource[] = [
  // ─── ISI UJ (Drupal) — 1 wydział ────────────────────────────────────
  {
    id: 'wziks',
    url: 'https://isi.uj.edu.pl/studenci/news/komunikaty',
    parser: 'isi_drupal',
    faculty_departments: ['Wydział Zarządzania i Komunikacji Społecznej'],
    source_label: 'ISI UJ',
  },

  // ─── Liferay UJ Portal — 12 wydziałów ────────────────────────────────
  {
    id: 'wpia',
    url: 'https://wpia.uj.edu.pl/dla-studentow/komunikaty',
    parser: 'liferay',
    faculty_departments: ['Wydział Prawa i Administracji'],
    source_label: 'Portal WPiA UJ',
  },
  {
    id: 'filozoficzny',
    url: 'https://phils.uj.edu.pl/aktualnosci',
    parser: 'liferay',
    faculty_departments: ['Wydział Filozoficzny'],
    source_label: 'Portal WF UJ',
  },
  {
    id: 'historyczny',
    url: 'https://historyczny.uj.edu.pl/aktualnosci',
    parser: 'liferay',
    faculty_departments: ['Wydział Historyczny'],
    source_label: 'Portal WH UJ',
  },
  {
    id: 'filologiczny',
    url: 'https://filg.uj.edu.pl/aktualnosci/komunikaty',
    parser: 'liferay',
    faculty_departments: ['Wydział Filologiczny'],
    source_label: 'Portal WF UJ',
  },
  {
    id: 'polonistyka',
    url: 'https://polonistyka.uj.edu.pl/dla-studentow',
    parser: 'liferay',
    faculty_departments: ['Wydział Polonistyki'],
    source_label: 'Portal Polonistyki UJ',
  },
  {
    id: 'fais',
    url: 'https://fais.uj.edu.pl/dla-studentow/ogloszenia',
    parser: 'liferay',
    faculty_departments: ['Wydział Fizyki, Astronomii i Informatyki Stosowanej'],
    source_label: 'Portal FAIS UJ',
  },
  {
    id: 'matinf',
    url: 'https://matinf.uj.edu.pl/aktualnosci',
    parser: 'liferay',
    faculty_departments: ['Wydział Matematyki i Informatyki'],
    source_label: 'Portal WMiI UJ',
  },
  {
    id: 'chemia',
    url: 'https://chemia.uj.edu.pl/wydzial/know/aktualnosci',
    parser: 'liferay',
    faculty_departments: ['Wydział Chemii'],
    source_label: 'Portal WCh UJ',
  },
  {
    id: 'biologia',
    url: 'https://biologia.uj.edu.pl/aktualnosci/komunikaty',
    parser: 'liferay',
    faculty_departments: ['Wydział Biologii'],
    source_label: 'Portal WB UJ',
  },
  {
    id: 'wsmip',
    url: 'https://wsmip.uj.edu.pl/aktualnosci',
    parser: 'liferay',
    faculty_departments: ['Wydział Studiów Międzynarodowych i Politycznych'],
    source_label: 'Portal WSMiP UJ',
  },
  {
    id: 'wgig',
    url: 'https://wgig.uj.edu.pl/wydzial/komunikaty-wydzialowe',
    parser: 'liferay',
    faculty_departments: ['Wydział Geografii i Geologii'],
    source_label: 'Portal WGiG UJ',
  },
  {
    id: 'wbbib',
    url: 'https://wbbib.uj.edu.pl/dla-studentow/komunikaty-dla-studentow',
    parser: 'liferay',
    faculty_departments: ['Wydział Biochemii, Biofizyki i Biotechnologii'],
    source_label: 'Portal WBBiB UJ',
  },

  // ─── WordPress CM — 3 wydziały Collegium Medicum ────────────────────
  // Wydział Lekarski + Wydział Lekarsko-Stomatologiczny dzielą jeden portal
  // (kierunek lekarsko-dentystyczny jest częścią Wydziału Lekarskiego).
  {
    id: 'wl_cm',
    url: 'https://wl.cm.uj.edu.pl/ogloszenia/',
    parser: 'wordpress_cm',
    faculty_departments: ['Wydział Lekarski', 'Wydział Lekarsko-Stomatologiczny'],
    source_label: 'Portal WL UJ CM',
  },
  {
    id: 'wnz_cm',
    url: 'https://wnz.cm.uj.edu.pl/pl/komunikaty/',
    parser: 'wordpress_cm',
    faculty_departments: ['Wydział Nauk o Zdrowiu'],
    source_label: 'Portal WNZ UJ CM',
  },
  {
    id: 'farmacja_cm',
    url: 'https://farmacja.cm.uj.edu.pl/pl/aktualnosci/',
    parser: 'wordpress_cm',
    faculty_departments: ['Wydział Farmaceutyczny'],
    source_label: 'Portal WF UJ CM',
  },
]

/**
 * Mapa: nazwa wydziału z `profiles.department` → lista `source.id`
 * które obsługują tego wydziału. Używana przez UI / auto-routing.
 *
 * Zbudowana raz przy starcie modułu (immutable, mała tablica).
 */
export const DEPARTMENT_TO_SOURCE_IDS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>()
  for (const src of FACULTY_SOURCES) {
    for (const dept of src.faculty_departments) {
      const existing = map.get(dept) ?? []
      existing.push(src.id)
      map.set(dept, existing)
    }
  }
  return map
})()
