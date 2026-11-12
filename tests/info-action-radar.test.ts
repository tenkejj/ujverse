import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildRadarActions,
  radarSourceUrl,
} from '../src/lib/info/actionRadar.ts'
import {
  parseRadarChecks,
  serializeRadarChecks,
  withRadarCheck,
} from '../src/lib/info/radarChecks.ts'
import type {
  InfoAnnouncement,
  InfoRegistration,
} from '../src/lib/info/types.ts'

const NOW = new Date('2026-11-11T11:00:00Z')
const HOUR = 3_600_000
const at = (hours: number) =>
  new Date(NOW.getTime() + hours * HOUR).toISOString()
const FACULTY = 'Wydział Filozoficzny'
function registration(patch: Partial<InfoRegistration> = {}): InfoRegistration {
  return {
    kind: 'registration',
    id: 'r1',
    turaId: '101',
    title: 'Zapisy na zajęcia',
    code: 'WFz-1',
    unitCode: 'UJ.WFz',
    unitName: FACULTY,
    faculty: FACULTY,
    facultyShort: 'WFz',
    opensAt: at(-3),
    closesAt: at(12),
    url: 'https://usosweb.uj.edu.pl/kontroler.php?_action=example',
    registrationKind: 'inne',
    verifiedAt: at(-1),
    ...patch,
  }
}
function announcement(patch: Partial<InfoAnnouncement> = {}): InfoAnnouncement {
  return {
    kind: 'announcement',
    id: 'a1',
    title: 'Zmiana zajęć',
    excerpt: 'Treść ze źródła',
    body: 'Komunikat prowadzącego',
    faculty: FACULTY,
    facultyShort: 'WFz',
    sourceLabel: 'Wydział Filozoficzny',
    sourceUrl: 'https://filozofia.uj.edu.pl/komunikaty',
    sourceIsListing: false,
    status: 'cancelled',
    addedAt: at(-1),
    summary: null,
    lecturerName: null,
    mayHaveFullBody: false,
    ...patch,
  }
}
const input = (
  patch: Partial<Parameters<typeof buildRadarActions>[0]> = {},
) => ({
  faculty: FACULTY,
  registrations: [registration()],
  announcements: [],
  latestRegistrationVerifiedAt: at(-1),
  now: NOW,
  ...patch,
})

describe('source-backed action radar', () => {
  it('only allows official HTTPS source destinations, not lookalikes or credentials', () => {
    assert.equal(radarSourceUrl('https://uj.edu.pl.example.com/x'), null)
    assert.equal(radarSourceUrl('https://example.com/uj.edu.pl'), null)
    assert.equal(radarSourceUrl('javascript:alert(1)'), null)
    assert.equal(radarSourceUrl('http://uj.edu.pl/x'), null)
    assert.equal(radarSourceUrl('https://user:secret@uj.edu.pl/x'), null)
    assert.equal(
      radarSourceUrl('https://samorzad.cm-uj.krakow.pl/x'),
      'https://samorzad.cm-uj.krakow.pl/x',
    )
  })
  it('uses confirmed closing times for urgency without asserting personal eligibility', () => {
    const [action] = buildRadarActions(input())
    assert.equal(action!.tone, 'urgent')
    assert.equal(action!.date, at(12))
    assert.match(action!.instruction, /czy obejmuje Twój kierunek/)
  })
  it('does not claim urgency for stale or future verification', () => {
    for (const verifiedAt of [at(-72), at(1), 'not-a-date']) {
      const [action] = buildRadarActions(
        input({ registrations: [registration({ verifiedAt })] }),
      )
      assert.equal(action!.tone, 'unconfirmed')
      assert.equal(action!.score, 20)
      assert.match(action!.caution!, /ponownego potwierdzenia/)
    }
    assert.equal(
      buildRadarActions(
        input({ registrations: [registration({ verifiedAt: at(1) })] }),
      )[0]!.evidenceAt,
      null,
    )
  })
  it('does not borrow freshness from another scraper run', () => {
    const [action] = buildRadarActions(
      input({
        registrations: [registration({ verifiedAt: at(-30) })],
        latestRegistrationVerifiedAt: at(-1),
      }),
    )
    assert.equal(action!.tone, 'unconfirmed')
  })
  it('drops ended, invalid, reversed and distant upcoming registration ranges', () => {
    const registrations = [
      registration({ id: 'closed', opensAt: at(-30), closesAt: at(-1) }),
      registration({ id: 'bad', opensAt: 'bad-date' }),
      registration({ id: 'bad-end', closesAt: 'bad-date' }),
      registration({ id: 'reverse', opensAt: at(4), closesAt: at(1) }),
      registration({ id: 'far', opensAt: at(24 * 9), closesAt: at(24 * 10) }),
    ]
    assert.deepEqual(buildRadarActions(input({ registrations })), [])
  })
  it('does not invent an end date for an open-ended source', () => {
    const [action] = buildRadarActions(
      input({ registrations: [registration({ closesAt: null })] }),
    )
    assert.equal(action!.date, null)
    assert.equal(action!.tone, 'open')
  })
  it('honours faculty matching, while the all-university scope remains explicit', () => {
    const other = registration({ faculty: 'Wydział Chemii' })
    assert.deepEqual(buildRadarActions(input({ registrations: [other] })), [])
    assert.equal(
      buildRadarActions(input({ faculty: null, registrations: [other] }))[0]!
        .faculty,
      'Wydział Chemii',
    )
    assert.deepEqual(
      buildRadarActions(
        input({ registrations: [registration({ faculty: null })] }),
      ),
      [],
    )
  })
  it('requires a live USOS identifier and official URL', () => {
    assert.deepEqual(
      buildRadarActions(
        input({ registrations: [registration({ turaId: '' })] }),
      ),
      [],
    )
    assert.deepEqual(
      buildRadarActions(
        input({
          registrations: [registration({ url: 'https://untrusted.example/x' })],
        }),
      ),
      [],
    )
  })
  it('uses only recent explicit status, never scholarship keywords or AI summary as a duty', () => {
    const announcements = [
      announcement({
        id: 'scholarship',
        title: 'Stypendium: pilnie złóż wniosek',
        status: 'info',
        summary: 'Złóż do jutra',
      }),
      announcement({ id: 'old', addedAt: at(-73) }),
      announcement({ id: 'future', addedAt: at(1) }),
      announcement({ id: 'good', status: 'remote' }),
    ]
    const actions = buildRadarActions(
      input({ registrations: [], announcements }),
    )
    assert.equal(actions.length, 1)
    assert.equal(actions[0]!.tone, 'remote')
    assert.equal(actions[0]!.date, null)
    assert.match(
      actions[0]!.caution!,
      /nie potwierdza automatycznie zmiany Twojego planu/,
    )
  })
  it('prioritises fresh urgent registrations and deduplicates repeated records', () => {
    const urgent = registration()
    const actions = buildRadarActions(
      input({
        registrations: [urgent, urgent],
        announcements: [announcement()],
      }),
    )
    assert.equal(actions.length, 2)
    assert.equal(actions[0]!.kind, 'registration')
    assert.equal(buildRadarActions(input({ limit: 1 })).length, 1)
  })
  it('does not reopen acknowledgements merely because a scraper reconfirmed the same deadline', () => {
    const first = buildRadarActions(input())[0]!
    const refreshed = buildRadarActions(
      input({ registrations: [registration({ verifiedAt: at(-0.5) })] }),
    )[0]!
    const changed = buildRadarActions(
      input({ registrations: [registration({ closesAt: at(24) })] }),
    )[0]!
    assert.equal(first.key, refreshed.key)
    assert.notEqual(first.key, changed.key)
  })
  it('reopens a source change when announcement text or status changes', () => {
    const first = buildRadarActions(
      input({ registrations: [], announcements: [announcement()] }),
    )[0]!
    const edited = buildRadarActions(
      input({
        registrations: [],
        announcements: [announcement({ body: 'Zmieniony zakres odwołania' })],
      }),
    )[0]!
    assert.notEqual(first.key, edited.key)
  })
})

describe('device-only checked markers', () => {
  const key = 'registration:r1:abc123'
  it('round-trips versioned markers without storing source text or account details', () => {
    const checks = withRadarCheck({}, key, true, NOW)
    assert.deepEqual(parseRadarChecks(serializeRadarChecks(checks)), checks)
    assert.deepEqual(withRadarCheck(checks, key, false, NOW), {})
  })
  it('rejects malformed, unversioned and oversized input', () => {
    assert.deepEqual(parseRadarChecks('broken json'), {})
    assert.deepEqual(
      parseRadarChecks(JSON.stringify({ entries: [[key, NOW.toISOString()]] })),
      {},
    )
    assert.deepEqual(
      parseRadarChecks(
        JSON.stringify({
          version: 1,
          entries: [
            ['__proto__', NOW.toISOString()],
            [key, 'bad-date'],
          ],
        }),
      ),
      {},
    )
    assert.deepEqual(parseRadarChecks(' '.repeat(30_001)), {})
  })
  it('bounds retained local markers to the latest hundred', () => {
    let checks = {}
    for (let i = 0; i < 120; i++)
      checks = withRadarCheck(checks, `registration:r${i}:abc123`, true, NOW)
    assert.equal(Object.keys(checks).length, 100)
    assert.equal('registration:r0:abc123' in checks, false)
    assert.equal('registration:r119:abc123' in checks, true)
  })
})
