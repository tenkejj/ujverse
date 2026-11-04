import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeRegistrationsSorted,
  buildPriorityItems,
  canShowCountdown,
  isRegistrationDataStale,
  isRegistrationVerified,
  registrationTiming,
  sortAnnouncementsNewestFirst,
  upcomingEventsSorted,
} from '../src/lib/info/relevance.ts'
import type { InfoAnnouncement, InfoEvent, InfoRegistration } from '../src/lib/info/types.ts'

const NOW = new Date('2026-11-04T20:00:00Z')
const HOUR = 3_600_000
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString()

function reg(partial: Partial<InfoRegistration> & { id: string }): InfoRegistration {
  return {
    kind: 'registration',
    turaId: partial.id,
    title: `Rejestracja ${partial.id}`,
    code: null,
    unitName: 'Instytut',
    unitCode: 'UJ.WZ.X',
    faculty: 'Wydział Zarządzania i Komunikacji Społecznej',
    facultyShort: 'WZiKS',
    opensAt: at(-48),
    closesAt: at(48),
    url: 'https://www.usosweb.uj.edu.pl/',
    registrationKind: 'inne',
    verifiedAt: at(-1),
    ...partial,
  }
}

function ann(partial: Partial<InfoAnnouncement> & { id: string }): InfoAnnouncement {
  return {
    kind: 'announcement',
    title: `Komunikat ${partial.id}`,
    excerpt: '',
    body: '',
    faculty: 'Wydział Zarządzania i Komunikacji Społecznej',
    facultyShort: 'WZiKS',
    sourceLabel: 'ISI UJ',
    sourceUrl: 'https://isi.uj.edu.pl/studenci/news/komunikaty',
    sourceIsListing: true,
    status: 'info',
    addedAt: at(-2),
    summary: null,
    lecturerName: null,
    mayHaveFullBody: false,
    ...partial,
  }
}

describe('registrationTiming', () => {
  it('classifies open / upcoming / closed with urgency windows', () => {
    assert.deepEqual(
      [registrationTiming(reg({ id: 'a', closesAt: at(10) }), NOW).phase, registrationTiming(reg({ id: 'a', closesAt: at(10) }), NOW).urgency],
      ['open', 'closing-critical'],
    )
    assert.equal(registrationTiming(reg({ id: 'b', closesAt: at(60) }), NOW).urgency, 'closing-soon')
    assert.equal(registrationTiming(reg({ id: 'c', closesAt: at(24 * 30) }), NOW).urgency, 'none')
    assert.equal(registrationTiming(reg({ id: 'd', opensAt: at(5), closesAt: at(50) }), NOW).urgency, 'opening-soon')
    assert.equal(registrationTiming(reg({ id: 'e', opensAt: at(24 * 10), closesAt: at(24 * 12) }), NOW).phase, 'upcoming')
    assert.equal(registrationTiming(reg({ id: 'f', opensAt: at(-100), closesAt: at(-1) }), NOW).phase, 'closed')
  })

  it('treats a registration without an end date as open once started', () => {
    const t = registrationTiming(reg({ id: 'g', closesAt: null }), NOW)
    assert.equal(t.phase, 'open')
    assert.equal(t.urgency, 'none')
  })
})

describe('activeRegistrationsSorted', () => {
  it('never returns closed registrations and orders by the nearest deadline', () => {
    const list = [
      reg({ id: 'upcoming-late', opensAt: at(24 * 9), closesAt: at(24 * 10) }),
      reg({ id: 'closed', opensAt: at(-100), closesAt: at(-1) }),
      reg({ id: 'open-later', closesAt: at(100) }),
      reg({ id: 'upcoming-soon', opensAt: at(3), closesAt: at(24 * 4) }),
      reg({ id: 'open-soon', closesAt: at(5) }),
      reg({ id: 'open-endless', closesAt: null }),
    ]
    assert.deepEqual(
      activeRegistrationsSorted(list, NOW).map((r) => r.id),
      ['open-soon', 'open-later', 'open-endless', 'upcoming-soon', 'upcoming-late'],
    )
  })
})

describe('verification and countdowns', () => {
  it('requires a recent scraper confirmation', () => {
    assert.equal(isRegistrationVerified(reg({ id: 'a', verifiedAt: at(-3) }), NOW, at(-1)), true)
    assert.equal(isRegistrationVerified(reg({ id: 'b', verifiedAt: at(-50) }), NOW, null), false)
    assert.equal(isRegistrationVerified(reg({ id: 'c', verifiedAt: at(-30) }), NOW, at(-2)), false)
  })

  it('flags the whole dataset as stale after 36 h without a run', () => {
    assert.equal(isRegistrationDataStale(at(-12), NOW), false)
    assert.equal(isRegistrationDataStale(at(-40), NOW), true)
    assert.equal(isRegistrationDataStale(null, NOW), true)
  })

  it('shows countdowns only for verified, near deadlines', () => {
    const near = reg({ id: 'near', closesAt: at(30) })
    const far = reg({ id: 'far', closesAt: at(24 * 120) })
    const stale = reg({ id: 'stale', closesAt: at(30), verifiedAt: at(-60) })
    assert.equal(canShowCountdown(near, registrationTiming(near, NOW), NOW, at(-1)), true)
    assert.equal(canShowCountdown(far, registrationTiming(far, NOW), NOW, at(-1)), false)
    assert.equal(canShowCountdown(stale, registrationTiming(stale, NOW), NOW, at(-1)), false)
  })
})

describe('buildPriorityItems', () => {
  const faculty = 'Wydział Zarządzania i Komunikacji Społecznej'

  it('returns nothing without a selected faculty', () => {
    assert.deepEqual(
      buildPriorityItems({
        faculty: null,
        announcements: [ann({ id: 'x', status: 'cancelled' })],
        registrations: [reg({ id: 'y', closesAt: at(5) })],
        now: NOW,
        latestRegistrationVerifiedAt: at(-1),
      }),
      [],
    )
  })

  it('ranks time-sensitive items for the selected faculty only', () => {
    const items = buildPriorityItems({
      faculty,
      announcements: [
        ann({ id: 'cancel-new', status: 'cancelled', addedAt: at(-5) }),
        ann({ id: 'cancel-old', status: 'cancelled', addedAt: at(-100) }),
        ann({ id: 'remote', status: 'remote', addedAt: at(-1) }),
        ann({ id: 'info', status: 'info', addedAt: at(-1) }),
        ann({ id: 'other-faculty', status: 'cancelled', faculty: 'Wydział Chemii', addedAt: at(-1) }),
      ],
      registrations: [
        reg({ id: 'closing-24h', closesAt: at(20) }),
        reg({ id: 'closing-72h', closesAt: at(60) }),
        reg({ id: 'opening', opensAt: at(10), closesAt: at(100) }),
        reg({ id: 'unverified', closesAt: at(2), verifiedAt: at(-80) }),
        reg({ id: 'other', closesAt: at(3), faculty: 'Wydział Chemii', unitCode: 'UJ.WCh' }),
      ],
      now: NOW,
      latestRegistrationVerifiedAt: at(-1),
      limit: 10,
    })
    assert.deepEqual(
      items.map((i) => `${i.score}:${i.key}`),
      [
        '100:registration:closing-24h',
        '90:announcement:cancel-new',
        '85:registration:closing-72h',
        '75:announcement:remote',
        '70:registration:opening',
      ],
    )
  })

  it('respects the limit and is deterministic', () => {
    const input = {
      faculty,
      announcements: [ann({ id: 'b', status: 'cancelled' as const }), ann({ id: 'a', status: 'cancelled' as const })],
      registrations: [],
      now: NOW,
      latestRegistrationVerifiedAt: null,
      limit: 1,
    }
    assert.deepEqual(buildPriorityItems(input).map((i) => i.key), ['announcement:a'])
    assert.deepEqual(buildPriorityItems(input), buildPriorityItems(input))
  })
})

describe('list ordering', () => {
  it('sorts announcements newest first with a stable tie-break', () => {
    const list = [ann({ id: 'b', addedAt: at(-1) }), ann({ id: 'a', addedAt: at(-1) }), ann({ id: 'c', addedAt: at(-10) })]
    assert.deepEqual(sortAnnouncementsNewestFirst(list).map((a) => a.id), ['a', 'b', 'c'])
  })

  it('keeps events from today (Warsaw) onwards', () => {
    const ev = (id: string, dayKey: string): InfoEvent => ({
      kind: 'event',
      id,
      externalId: id,
      title: id,
      description: '',
      dayKey,
      date: `${dayKey}T12:00:00.000Z`,
      location: null,
      category: null,
      sourceName: 'UJ',
      url: null,
      seenAt: null,
    })
    const late = new Date('2026-11-04T23:30:00Z') // 5 Nov in Warsaw
    assert.deepEqual(
      upcomingEventsSorted([ev('nov6', '2026-11-06'), ev('nov4', '2026-11-04'), ev('nov5', '2026-11-05')], late).map((e) => e.id),
      ['nov5', 'nov6'],
    )
  })
})
