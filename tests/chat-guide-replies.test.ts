import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tryGuideReply } from '../api/_lib/guideReplies.ts'

const now = new Date('2026-11-12T12:00:00Z')
describe('source-backed assistant procedures', () => {
  it('links a scholarship procedure and preserves the passed-deadline caveat', () => {
    const reply =
      tryGuideReply('Jak złożyć wniosek o stypendium rektora?', now) ?? ''
    assert.ok(reply.includes('/poradniki/stypendium-rektora'))
    assert.ok(reply.includes('już upłynął'))
    assert.ok(reply.includes('pierwszego roku'))
    assert.ok(reply.includes('https://'))
  })
  it('keeps the housing CM scope and never invents availability', () => {
    const reply = tryGuideReply('Gdzie złożyć wniosek o akademik?', now) ?? ''
    assert.ok(reply.includes('/poradniki/akademik'))
    assert.ok(reply.includes('poza Collegium Medicum'))
    assert.ok(reply.includes('w miarę wolnych miejsc'))
  })
  it('does not turn eligibility, personal timetable or arbitrary text into a procedure', () => {
    assert.equal(tryGuideReply('Czy dostanę stypendium rektora?', now), null)
    assert.equal(tryGuideReply('Co mam jutro w planie?', now), null)
    assert.equal(tryGuideReply('Jak działa pogoda?', now), null)
    assert.equal(tryGuideReply('Jak ' + 'akademik '.repeat(50), now), null)
  })
  it('stale guidance requires checking current official rules instead of presenting steps as fresh', () => {
    const reply =
      tryGuideReply(
        'Jak ubiegać się o akademik?',
        new Date('2027-03-01T12:00:00Z'),
      ) ?? ''
    assert.ok(reply.includes('wymaga ponownego sprawdzenia'))
    assert.equal(reply.includes('1. '), false)
    assert.ok(reply.includes('/poradniki/akademik'))
  })
})
