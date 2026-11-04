import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_INFO_PREFS,
  parseInfoPrefs,
  resolveFaculty,
  serializeInfoPrefs,
  withFacultyChoice,
  withSectionHidden,
} from '../src/lib/info/preferences.ts'

const WZIKS = 'Wydział Zarządzania i Komunikacji Społecznej'
const CHEMIA = 'Wydział Chemii'
const NOW = new Date('2026-11-04T20:00:00Z')

describe('parseInfoPrefs', () => {
  it('returns defaults for missing, broken or foreign data', () => {
    assert.deepEqual(parseInfoPrefs(null), DEFAULT_INFO_PREFS)
    assert.deepEqual(parseInfoPrefs('{not json'), DEFAULT_INFO_PREFS)
    assert.deepEqual(parseInfoPrefs('"string"'), DEFAULT_INFO_PREFS)
    assert.deepEqual(parseInfoPrefs(JSON.stringify({ version: 2, faculty: null })), DEFAULT_INFO_PREFS)
  })

  it('canonicalises aliases and drops unknown faculties', () => {
    const alias = parseInfoPrefs(JSON.stringify({ version: 1, faculty: { value: 'WZiKS', setBy: null, updatedAt: NOW.toISOString() } }))
    assert.equal(alias.faculty?.value, WZIKS)
    const unknown = parseInfoPrefs(JSON.stringify({ version: 1, faculty: { value: 'Wydział Magii', setBy: null, updatedAt: NOW.toISOString() } }))
    assert.equal(unknown.faculty, null)
  })

  it('keeps an explicit "Cały UJ" choice and filters hidden sections', () => {
    const prefs = parseInfoPrefs(
      JSON.stringify({ version: 1, faculty: { value: null, setBy: 'u1', updatedAt: 'bad' }, hiddenSections: ['events', 'nope', 'events'] }),
    )
    assert.deepEqual(prefs.faculty, { value: null, setBy: 'u1', updatedAt: new Date(0).toISOString() })
    assert.deepEqual(prefs.hiddenSections, ['events'])
  })

  it('round-trips through serialisation', () => {
    const prefs = withSectionHidden(withFacultyChoice(DEFAULT_INFO_PREFS, CHEMIA, null, NOW), 'tools', true)
    assert.deepEqual(parseInfoPrefs(serializeInfoPrefs(prefs)), prefs)
  })
})

describe('resolveFaculty', () => {
  const anonChoice = withFacultyChoice(DEFAULT_INFO_PREFS, CHEMIA, null, NOW)
  const userChoice = withFacultyChoice(DEFAULT_INFO_PREFS, CHEMIA, 'u1', NOW)

  it('1: a signed-in user keeps the choice they made on this device', () => {
    assert.deepEqual(resolveFaculty({ prefs: userChoice, sessionUserId: 'u1', profileDepartment: WZIKS }), {
      faculty: CHEMIA,
      source: 'device',
    })
  })

  it('2: otherwise the profile faculty wins for signed-in users', () => {
    assert.deepEqual(resolveFaculty({ prefs: anonChoice, sessionUserId: 'u1', profileDepartment: 'WZiKS' }), {
      faculty: WZIKS,
      source: 'profile',
    })
    assert.deepEqual(resolveFaculty({ prefs: userChoice, sessionUserId: 'u2', profileDepartment: WZIKS }), {
      faculty: WZIKS,
      source: 'profile',
    })
  })

  it('3: the device choice applies when there is no usable profile faculty', () => {
    assert.deepEqual(resolveFaculty({ prefs: anonChoice, sessionUserId: 'u1', profileDepartment: null }), {
      faculty: CHEMIA,
      source: 'device',
    })
    assert.deepEqual(resolveFaculty({ prefs: anonChoice, sessionUserId: null, profileDepartment: WZIKS }), {
      faculty: CHEMIA,
      source: 'device',
    })
  })

  it('4: nothing chosen means the whole university', () => {
    assert.deepEqual(resolveFaculty({ prefs: DEFAULT_INFO_PREFS, sessionUserId: null, profileDepartment: null }), {
      faculty: null,
      source: 'none',
    })
  })

  it('an explicit "Cały UJ" made while signed in overrides the profile', () => {
    const allUj = withFacultyChoice(DEFAULT_INFO_PREFS, null, 'u1', NOW)
    assert.deepEqual(resolveFaculty({ prefs: allUj, sessionUserId: 'u1', profileDepartment: WZIKS }), {
      faculty: null,
      source: 'device',
    })
  })
})

describe('withFacultyChoice', () => {
  it('ignores unknown faculties instead of storing them', () => {
    assert.equal(withFacultyChoice(DEFAULT_INFO_PREFS, 'Wydział Magii', null, NOW), DEFAULT_INFO_PREFS)
  })

  it('records who made the choice and when', () => {
    const prefs = withFacultyChoice(DEFAULT_INFO_PREFS, 'WZiKS', 'u1', NOW)
    assert.deepEqual(prefs.faculty, { value: WZIKS, setBy: 'u1', updatedAt: NOW.toISOString() })
  })
})
