import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_STUDY_PROFILE,
  PILOT_PROGRAMMES,
  matchVerifiedStudyAudience,
  parseStudyProfile,
  resolveStudyContext,
  withStudyDegree,
  withStudyProgramme,
  withStudyYear,
  type VerifiedStudyAudience,
} from '../src/lib/info/studyProfile.ts'

const EPI = PILOT_PROGRAMMES[0]!
const FILOZOFIA = PILOT_PROGRAMMES[1]!
const audience: VerifiedStudyAudience = {
  programmeIds: ['epi'],
  degrees: ['first'],
  years: [1],
  sourceUrl: EPI.sourceUrl,
  checkedOn: '2026-11-11',
}

describe('study profile pilot', () => {
  it('rejects damaged, unsupported and forged faculty/programme combinations', () => {
    for (const raw of [
      null,
      '{broken',
      '[]',
      '{"version":2}',
      JSON.stringify({
        version: 1,
        programmeId: 'magia',
        faculty: EPI.faculty,
      }),
      JSON.stringify({
        version: 1,
        programmeId: 'epi',
        faculty: FILOZOFIA.faculty,
      }),
    ]) {
      assert.deepEqual(parseStudyProfile(raw), DEFAULT_STUDY_PROFILE)
    }
  })

  it('retains only years supported by the selected degree and programme', () => {
    const undergraduate = withStudyYear(
      withStudyDegree(withStudyProgramme('epi'), 'first'),
      3,
    )
    assert.equal(undergraduate.year, 3)
    const postgraduate = withStudyDegree(undergraduate, 'second')
    assert.equal(postgraduate.year, null)
    assert.equal(withStudyYear(postgraduate, 3).year, null)
    assert.equal(withStudyYear(postgraduate, 2).year, 2)
    assert.equal(withStudyYear(postgraduate, 1.5).year, null)
  })

  it('deactivates a saved programme when the main faculty selection changes', () => {
    const profile = withStudyYear(
      withStudyDegree(withStudyProgramme('epi'), 'first'),
      1,
    )
    assert.equal(resolveStudyContext(profile, EPI.faculty).active, true)
    assert.equal(
      resolveStudyContext(profile, FILOZOFIA.faculty).programme,
      null,
    )
    assert.equal(resolveStudyContext(profile, null).active, false)
    assert.equal(resolveStudyContext(profile, EPI.faculty).profile.year, 1)
  })

  it('never excludes records with missing/unverified programme metadata', () => {
    const profile = withStudyYear(
      withStudyDegree(withStudyProgramme('epi'), 'first'),
      1,
    )
    assert.equal(matchVerifiedStudyAudience(profile), 'unspecified')
    assert.equal(
      matchVerifiedStudyAudience(profile, {
        ...audience,
        sourceUrl: 'https://uj.edu.pl.evil.example/',
      }),
      'unspecified',
    )
    assert.equal(
      matchVerifiedStudyAudience(profile, {
        ...audience,
        sourceUrl: 'javascript:alert(1)',
      }),
      'unspecified',
    )
    assert.equal(
      matchVerifiedStudyAudience(profile, { ...audience, checkedOn: 'bad' }),
      'unspecified',
    )
    assert.equal(
      matchVerifiedStudyAudience(profile, {
        ...audience,
        checkedOn: '2026-02-31',
      }),
      'unspecified',
    )
  })

  it('uses explicit source-backed audience dimensions and preserves unknown choices', () => {
    const incomplete = withStudyProgramme('epi')
    assert.equal(
      matchVerifiedStudyAudience(incomplete, audience),
      'unspecified',
    )
    const firstYear = withStudyYear(withStudyDegree(incomplete, 'first'), 1)
    assert.equal(matchVerifiedStudyAudience(firstYear, audience), 'matches')
    assert.equal(
      matchVerifiedStudyAudience(withStudyYear(firstYear, 2), audience),
      'outside',
    )
    assert.equal(
      matchVerifiedStudyAudience(withStudyProgramme('filozofia'), audience),
      'outside',
    )
    assert.equal(
      matchVerifiedStudyAudience({ ...DEFAULT_STUDY_PROFILE }, audience),
      'unspecified',
    )
  })
})
