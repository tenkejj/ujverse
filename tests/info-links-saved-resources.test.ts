import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  safeExternalUrl,
  sanitizeNextPath,
  urlDedupKey,
} from '../src/lib/info/links.ts'
import { searchResources } from '../src/lib/info/resources.ts'
import {
  SAVED_LIMIT,
  isSaved,
  parseSaved,
  serializeSaved,
  toggleSavedItem,
  type SavedItem,
} from '../src/lib/info/saved.ts'

describe('safeExternalUrl', () => {
  it('accepts only absolute http(s) URLs', () => {
    assert.equal(
      safeExternalUrl('https://wpia.uj.edu.pl/a'),
      'https://wpia.uj.edu.pl/a',
    )
    assert.equal(safeExternalUrl(' http://x.uj.edu.pl '), 'http://x.uj.edu.pl/')
    assert.equal(safeExternalUrl('javascript:alert(1)'), null)
    assert.equal(safeExternalUrl('data:text/html,hi'), null)
    assert.equal(safeExternalUrl('/relative/path'), null)
    assert.equal(safeExternalUrl('ftp://files.uj.edu.pl'), null)
    assert.equal(safeExternalUrl(''), null)
    assert.equal(safeExternalUrl(null), null)
  })

  it('builds comparable dedup keys', () => {
    assert.equal(
      urlDedupKey('https://WPIA.uj.edu.pl/a/#x'),
      urlDedupKey('https://wpia.uj.edu.pl/a'),
    )
    assert.notEqual(
      urlDedupKey('https://wpia.uj.edu.pl/a?id=1'),
      urlDedupKey('https://wpia.uj.edu.pl/a?id=2'),
    )
  })
})

describe('sanitizeNextPath', () => {
  it('allows in-app paths only', () => {
    assert.equal(sanitizeNextPath('/moj-plan'), '/moj-plan')
    assert.equal(sanitizeNextPath('/thread/12?x=1#c'), '/thread/12?x=1#c')
    assert.equal(sanitizeNextPath('//evil.example/x'), null)
    assert.equal(sanitizeNextPath('/\\evil.example'), null)
    assert.equal(sanitizeNextPath('https://evil.example'), null)
    assert.equal(sanitizeNextPath('moj-plan'), null)
    assert.equal(sanitizeNextPath('/logowanie?next=/x'), null)
    assert.equal(sanitizeNextPath(null), null)
  })
})

describe('saved items', () => {
  const item = (id: string): SavedItem => ({
    kind: 'announcement',
    id,
    title: `Komunikat ${id}`,
    url: 'https://isi.uj.edu.pl/',
    context: 'WZiKS',
    dueAt: null,
    savedAt: '2026-11-04T20:00:00.000Z',
  })

  it('toggles items on and off', () => {
    const one = toggleSavedItem([], item('a'))
    assert.equal(isSaved(one, 'announcement', 'a'), true)
    assert.equal(
      isSaved(toggleSavedItem(one, item('a')), 'announcement', 'a'),
      false,
    )
  })

  it('caps the list and keeps the newest first', () => {
    let list: SavedItem[] = []
    for (let i = 0; i < SAVED_LIMIT + 5; i++)
      list = toggleSavedItem(list, item(String(i)))
    assert.equal(list.length, SAVED_LIMIT)
    assert.equal(list[0].id, String(SAVED_LIMIT + 4))
  })

  it('parses defensively and drops unsafe links', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        item('a'),
        { ...item('b'), url: 'javascript:alert(1)' },
        { kind: 'post', id: 'x' },
        item('a'),
      ],
    })
    const parsed = parseSaved(raw)
    assert.deepEqual(
      parsed.map((i) => i.id),
      ['a', 'b'],
    )
    assert.equal(parsed[1].url, null)
    assert.deepEqual(parseSaved('nope'), [])
    assert.deepEqual(
      parseSaved(serializeSaved([item('z')])).map((i) => i.id),
      ['z'],
    )
  })
})

describe('searchResources', () => {
  it('matches without diacritics and requires all words', () => {
    assert.deepEqual(
      searchResources('poczta').map((r) => r.id),
      ['poczta'],
    )
    assert.deepEqual(
      searchResources('znizki').map((r) => r.id),
      ['znizki'],
    )
    assert.deepEqual(
      searchResources('Zniżki').map((r) => r.id),
      ['znizki'],
    )
    assert.deepEqual(
      searchResources('rejestracja przedmioty').map((r) => r.id),
      ['guide-registrations', 'usos-rejestracje'],
    )
    assert.deepEqual(
      searchResources('stypendium rektora').map((r) => r.id),
      ['guide-scholarship'],
    )
    assert.deepEqual(
      searchResources('akademik').map((r) => r.id),
      ['guide-housing'],
    )
    assert.deepEqual(searchResources('   '), [])
  })
})
