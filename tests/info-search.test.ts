import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeSearchQuery,
  orderByIds,
  orderEventSearchResults,
  toIlikePattern,
} from '../src/lib/info/search.ts'
import type { InfoEvent } from '../src/lib/info/types.ts'

describe('search query helpers', () => {
  it('normalises whitespace and length', () => {
    assert.equal(normalizeSearchQuery('  stypendium   rektora '), 'stypendium rektora')
    assert.equal(normalizeSearchQuery('x'.repeat(200)).length, 80)
    assert.equal(normalizeSearchQuery(undefined), '')
  })

  it('builds PostgREST-safe ilike patterns', () => {
    assert.equal(toIlikePattern('lektorat'), '%lektorat%')
    assert.equal(toIlikePattern('a,b(c)'), '%a b c%')
    assert.equal(toIlikePattern('100%_done'), '%100\\%\\_done%')
    assert.equal(toIlikePattern('*'), null)
    assert.equal(toIlikePattern(' a '), null)
  })

  it('orders hydrated rows by search rank', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    assert.deepEqual(orderByIds(items, ['c', 'x', 'a']).map((i) => i.id), ['c', 'a'])
  })

  it('lists upcoming events before past ones', () => {
    const ev = (id: string, dayKey: string) => ({ id, dayKey }) as InfoEvent
    const now = new Date('2026-11-04T12:00:00Z')
    assert.deepEqual(
      orderEventSearchResults([ev('past-old', '2026-09-01'), ev('next', '2026-11-20'), ev('today', '2026-11-04'), ev('past-new', '2026-10-30')], now).map((e) => e.id),
      ['today', 'next', 'past-new', 'past-old'],
    )
  })
})
