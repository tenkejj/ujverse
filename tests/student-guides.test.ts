import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findStudentGuide,
  needsGuideReview,
  parseGuideProgress,
  STUDENT_GUIDES,
  STUDENT_SUPPORT_RESOURCES,
} from '../src/lib/info/guides.ts'

test('each procedural step points to a declared official source', () => {
  assert.equal(new Set(STUDENT_GUIDES.map((guide) => guide.slug)).size, STUDENT_GUIDES.length)
  for (const guide of STUDENT_GUIDES) {
    const sourceIds = new Set(guide.sources.map((source) => source.id))
    assert.equal(sourceIds.size, guide.sources.length)
    assert.equal(
      new Set(guide.steps.map((step) => step.id)).size,
      guide.steps.length,
    )
    for (const step of guide.steps) {
      assert.ok(
        step.sourceIds.length > 0,
        `${guide.slug}/${step.id} requires evidence`,
      )
      for (const id of step.sourceIds)
        assert.ok(sourceIds.has(id), `${guide.slug}/${step.id}: ${id}`)
    }
    for (const source of guide.sources) {
      const url = new URL(source.url)
      assert.equal(url.protocol, 'https:')
      assert.ok(
        url.hostname === 'uj.edu.pl' || url.hostname.endsWith('.uj.edu.pl'),
      )
    }
    assert.equal(guide.academicYear, '2026/2027')
    assert.match(guide.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
  }
  for (const resource of STUDENT_SUPPORT_RESOURCES)
    assert.ok(new URL(resource.url).hostname.endsWith('.uj.edu.pl'))
})

test('local progress accepts current steps and ignores unknown fields, repeats and malformed storage', () => {
  const input = JSON.stringify({
    akademik: ['form', 'form', 'allocation', 'not-a-current-step', null, 19],
    'stypendium-rektora': 'not-an-array',
    'rejestracje-usos': ['find', 'attach'],
    email: 'not-account-data',
  })
  assert.deepEqual(parseGuideProgress(input), {
    akademik: ['form', 'allocation'],
    'rejestracje-usos': ['find', 'attach'],
  })
  for (const raw of [null, '{broken', '[]', 'null', '"text"'])
    assert.deepEqual(parseGuideProgress(raw), {})
})

test('guide lookup does not silently present another procedure for an unknown slug', () => {
  assert.equal(findStudentGuide('akademik')?.slug, 'akademik')
  assert.equal(findStudentGuide('unknown'), undefined)
  assert.equal(findStudentGuide(undefined), undefined)
})

test('old or invalid review dates cannot claim current editorial checking', () => {
  assert.equal(
    needsGuideReview(
      { checkedAt: '2026-11-11' },
      new Date('2026-11-11T12:00:00Z'),
    ),
    false,
  )
  assert.equal(
    needsGuideReview(
      { checkedAt: '2026-11-11' },
      new Date('2027-03-01T12:00:00Z'),
    ),
    true,
  )
  assert.equal(needsGuideReview({ checkedAt: 'bad-date' }), true)
  assert.equal(
    needsGuideReview(
      { checkedAt: '2027-11-11' },
      new Date('2026-11-11T12:00:00Z'),
    ),
    true,
  )
})

test('housing scope retains Collegium Medicum separation and no global registration deadline is fabricated', () => {
  const housing = findStudentGuide('akademik')!
  assert.match(housing.scope, /poza Collegium Medicum/)
  assert.ok(housing.exception?.url.startsWith('https://sdka.cm.uj.edu.pl/'))
  assert.match(
    findStudentGuide('rejestracje-usos')!.deadline,
    /Nie ma jednego terminu/,
  )
})
