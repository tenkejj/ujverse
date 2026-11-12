import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  boundedSearchLimit,
  canShowSearchProfile,
  visibleSearchDepartment,
} from '../src/lib/searchPolicy.ts'
import { toIlikePattern } from '../src/lib/info/search.ts'

describe('database search privacy and bounds', () => {
  it('excludes hidden and banned profiles', () => {
    assert.equal(canShowSearchProfile({ is_searchable: false }), false)
    assert.equal(canShowSearchProfile({}), false)
    assert.equal(canShowSearchProfile({ is_searchable: null }), false)
    assert.equal(
      canShowSearchProfile({ is_searchable: true, is_banned: true }),
      false,
    )
    assert.equal(
      canShowSearchProfile({ is_searchable: true, is_banned: false }),
      true,
    )
  })

  it('does not return a hidden department through search metadata', () => {
    assert.equal(
      visibleSearchDepartment({
        department: 'Wydział testowy',
        show_department: false,
      }),
      null,
    )
    assert.equal(visibleSearchDepartment({ department: 'Ukryty' }), null)
    assert.equal(
      visibleSearchDepartment({
        department: 'Wydział testowy',
        show_department: true,
      }),
      'Wydział testowy',
    )
  })

  it('bounds attacker-controlled pagination and rejects non-finite limits', () => {
    assert.equal(boundedSearchLimit(100000), 50)
    assert.equal(boundedSearchLimit(-10), 1)
    assert.equal(boundedSearchLimit(3.9), 3)
    assert.equal(boundedSearchLimit(Number.NaN, 24), 24)
    assert.equal(boundedSearchLimit(Infinity), 20)
  })

  it('does not turn punctuation or wildcard input into an unfiltered read', () => {
    assert.equal(toIlikePattern('*'), null)
    assert.equal(toIlikePattern('"()*'), null)
    assert.equal(toIlikePattern('100%_'), '%100\\%\\_%')
    const pattern = toIlikePattern('a),id.gt.0,(name')
    assert.ok(pattern)
    assert.equal(/[(),"]/.test(pattern), false)
  })
})
