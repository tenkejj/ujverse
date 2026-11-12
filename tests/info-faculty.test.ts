import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  facultyDbValues,
  facultyFromUsosUnitCode,
  facultyListingSource,
  facultyShortLabel,
  matchesFaculty,
  toKnownFaculty,
  usosUnitCatalogUrl,
  USOS_REGISTRATION_CATALOG_URL,
} from '../src/lib/info/faculty.ts'
import { UJ_DEPARTMENTS } from '../src/lib/departments.ts'

describe('facultyFromUsosUnitCode', () => {
  it('maps observed USOS unit prefixes to canonical faculties', () => {
    assert.equal(facultyFromUsosUnitCode('UJ.WZ.IDMiKS'), 'Wydział Zarządzania i Komunikacji Społecznej')
    assert.equal(facultyFromUsosUnitCode('UJ.WFz.IF'), 'Wydział Filozoficzny')
    assert.equal(facultyFromUsosUnitCode('UJ.WF.IFA'), 'Wydział Filologiczny')
    assert.equal(facultyFromUsosUnitCode('UJ.WBl'), 'Wydział Biologii')
    assert.equal(facultyFromUsosUnitCode('UJ.WSM.KU'), 'Wydział Studiów Międzynarodowych i Politycznych')
  })

  it('does not guess for university-wide or unknown units', () => {
    assert.equal(facultyFromUsosUnitCode('UJ.SDSP'), null)
    assert.equal(facultyFromUsosUnitCode('UJ.MISH'), null)
    assert.equal(facultyFromUsosUnitCode('UJ'), null)
    assert.equal(facultyFromUsosUnitCode('XX.WZ.IDM'), null)
    assert.equal(facultyFromUsosUnitCode(''), null)
    assert.equal(facultyFromUsosUnitCode(null), null)
  })

  it('only ever returns faculties from the canonical list', () => {
    for (const prefix of ['WBl', 'WBt', 'WCh', 'WF', 'WFa', 'WFAI', 'WFz', 'WH', 'WL', 'WMI', 'WOZ', 'WPA', 'WPl', 'WSM', 'WZ']) {
      const faculty = facultyFromUsosUnitCode(`UJ.${prefix}.X`)
      assert.ok(faculty && (UJ_DEPARTMENTS as readonly string[]).includes(faculty), prefix)
    }
  })
})

describe('faculty aliases', () => {
  it('canonicalises legacy names and rejects unknown ones', () => {
    assert.equal(toKnownFaculty('Collegium Medicum – Wydział Lekarski'), 'Wydział Lekarski')
    assert.equal(toKnownFaculty('WZiKS'), 'Wydział Zarządzania i Komunikacji Społecznej')
    assert.equal(toKnownFaculty('Wydział Magii'), null)
    assert.equal(toKnownFaculty(null), null)
  })

  it('matches faculty groups (Lekarski ↔ Lekarsko-Stomatologiczny)', () => {
    assert.equal(matchesFaculty('Wydział Lekarski', 'Wydział Lekarsko-Stomatologiczny'), true)
    assert.equal(matchesFaculty('Wydział Lekarski', 'Wydział Lekarski'), true)
    assert.equal(matchesFaculty('Wydział Chemii', 'Wydział Lekarski'), false)
  })

  it('treats "no selection" as all-university and missing item faculty as non-matching', () => {
    assert.equal(matchesFaculty('Wydział Chemii', null), true)
    assert.equal(matchesFaculty(null, 'Wydział Chemii'), false)
  })

  it('includes legacy alias values when querying announcements', () => {
    assert.deepEqual(facultyDbValues('Wydział Zarządzania i Komunikacji Społecznej').sort(), [
      'WZiKS',
      'Wydział Zarządzania i Komunikacji Społecznej',
    ])
    assert.deepEqual(facultyDbValues('Wydział Lekarsko-Stomatologiczny').sort(), [
      'Collegium Medicum – Wydział Lekarski',
      'Wydział Lekarski',
      'Wydział Lekarsko-Stomatologiczny',
    ])
    assert.deepEqual(facultyDbValues(null), [])
  })

  it('returns short labels', () => {
    assert.equal(facultyShortLabel('Wydział Zarządzania i Komunikacji Społecznej'), 'WZiKS')
    assert.equal(facultyShortLabel(null), null)
  })
})

describe('source links', () => {
  it('finds the listing page used by the scraper', () => {
    assert.equal(
      facultyListingSource('Wydział Zarządzania i Komunikacji Społecznej')?.url,
      'https://isi.uj.edu.pl/studenci/news/komunikaty',
    )
    assert.equal(facultyListingSource('Wydział Lekarsko-Stomatologiczny')?.url, 'https://wl.cm.uj.edu.pl/ogloszenia/')
    assert.equal(facultyListingSource('Nieznany'), null)
  })

  it('builds USOSweb unit catalogue links and rejects odd codes', () => {
    assert.match(usosUnitCatalogUrl('UJ.WF.IFA'), /jed_org_kod=UJ\.WF\.IFA$/)
    assert.equal(usosUnitCatalogUrl('UJ.WF"><script>'), USOS_REGISTRATION_CATALOG_URL)
    assert.equal(usosUnitCatalogUrl(null), USOS_REGISTRATION_CATALOG_URL)
  })
})
