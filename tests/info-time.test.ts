import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatDate,
  formatDayLabel,
  formatDurationShort,
  formatRelativePast,
  formatTime,
  pluralPL,
  warsawDayDiff,
  warsawDayKey,
} from '../src/lib/info/time.ts'
import { warsawLocalStringToUtcIso, warsawLocalToUtc } from '../src/lib/warsawTime.ts'

describe('warsawDayKey', () => {
  it('uses the Warsaw calendar day, not UTC', () => {
    assert.equal(warsawDayKey(new Date('2026-11-04T23:30:00Z')), '2026-11-05')
    assert.equal(warsawDayKey(new Date('2026-07-01T21:59:00Z')), '2026-07-01')
    assert.equal(warsawDayKey(new Date('2026-07-01T22:00:00Z')), '2026-07-02')
  })

  it('handles the spring DST change (29 March 2026)', () => {
    assert.equal(warsawDayKey(new Date('2026-03-28T23:30:00Z')), '2026-03-29')
    assert.equal(warsawDayKey(new Date('2026-03-29T21:59:00Z')), '2026-03-29')
    assert.equal(warsawDayKey(new Date('2026-03-29T22:00:00Z')), '2026-03-30')
  })

  it('handles the autumn DST change (25 October 2026)', () => {
    assert.equal(warsawDayKey(new Date('2026-10-24T22:30:00Z')), '2026-10-25')
    assert.equal(warsawDayKey(new Date('2026-10-25T22:59:00Z')), '2026-10-25')
    assert.equal(warsawDayKey(new Date('2026-10-25T23:00:00Z')), '2026-10-26')
  })
})

describe('warsawDayDiff', () => {
  it('counts calendar days across a 25-hour DST day', () => {
    assert.equal(
      warsawDayDiff(new Date('2026-10-24T22:30:00Z'), new Date('2026-10-25T23:30:00Z')),
      1,
    )
  })

  it('treats late evening and early morning of the next day as one day apart', () => {
    assert.equal(
      warsawDayDiff(new Date('2026-11-04T22:50:00Z'), new Date('2026-11-04T23:10:00Z')),
      1,
    )
  })
})

describe('formatTime', () => {
  it('formats in Europe/Warsaw for summer and winter time', () => {
    assert.equal(formatTime(new Date('2026-07-01T10:00:00Z')), '12:00')
    assert.equal(formatTime(new Date('2026-12-01T10:00:00Z')), '11:00')
  })
})

describe('formatDate', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  it('omits the year for the current year and shows it otherwise', () => {
    assert.match(formatDate(new Date('2026-11-12T10:00:00Z'), now), /^12 lis/)
    assert.doesNotMatch(formatDate(new Date('2026-11-12T10:00:00Z'), now), /2026/)
    assert.match(formatDate(new Date('2027-02-11T10:00:00Z'), now), /2027/)
  })
})

describe('formatRelativePast', () => {
  const now = new Date('2026-11-04T20:00:00Z')
  it('describes recent moments', () => {
    assert.equal(formatRelativePast(new Date('2026-11-04T19:59:30Z'), now), 'przed chwilą')
    assert.equal(formatRelativePast(new Date('2026-11-04T19:45:00Z'), now), '15 min temu')
    assert.equal(formatRelativePast(new Date('2026-11-04T14:05:00Z'), now), '5 godz. temu')
  })

  it('uses calendar days for older dates', () => {
    assert.equal(formatRelativePast(new Date('2026-11-03T08:12:00Z'), now), 'wczoraj, 09:12')
    assert.equal(formatRelativePast(new Date('2026-10-31T10:00:00Z'), now), '4 dni temu')
    assert.match(formatRelativePast(new Date('2026-10-01T10:00:00Z'), now), /^1 paź/)
  })

  it('does not claim "przed chwilą" for timestamps far in the future', () => {
    assert.doesNotMatch(formatRelativePast(new Date('2026-11-06T10:00:00Z'), now), /chwil/)
  })
})

describe('formatDayLabel', () => {
  const now = new Date('2026-11-04T23:30:00Z') // 5 Nov 00:30 in Warsaw
  it('labels today and tomorrow on the Warsaw calendar', () => {
    assert.equal(formatDayLabel('2026-11-05', now), 'Dziś')
    assert.equal(formatDayLabel('2026-11-06', now), 'Jutro')
    assert.match(formatDayLabel('2026-11-09', now), /9 lis/)
  })
})

describe('formatDurationShort / pluralPL', () => {
  it('formats durations', () => {
    assert.equal(formatDurationShort(10 * 60_000), '10 min')
    assert.equal(formatDurationShort(5 * 3_600_000 + 1), '5 godz.')
    assert.equal(formatDurationShort(3 * 86_400_000), '3 dni')
    assert.equal(formatDurationShort(86_400_000), '1 dzień')
    assert.equal(formatDurationShort(-5), '1 min')
  })

  it('applies Polish plural rules', () => {
    const forms = (n: number) => pluralPL(n, 'godzina', 'godziny', 'godzin')
    assert.equal(forms(1), 'godzina')
    assert.equal(forms(2), 'godziny')
    assert.equal(forms(5), 'godzin')
    assert.equal(forms(12), 'godzin')
    assert.equal(forms(22), 'godziny')
    assert.equal(forms(25), 'godzin')
  })
})

describe('warsawLocalToUtc (used by the USOS scraper)', () => {
  it('uses +01:00 before the spring change and +02:00 after it', () => {
    assert.equal(warsawLocalToUtc(2026, 3, 15, 9, 0).toISOString(), '2026-03-15T08:00:00.000Z')
    assert.equal(warsawLocalToUtc(2026, 3, 30, 9, 0).toISOString(), '2026-03-30T07:00:00.000Z')
  })

  it('uses +01:00 after the autumn change', () => {
    assert.equal(warsawLocalToUtc(2026, 10, 20, 9, 0).toISOString(), '2026-10-20T07:00:00.000Z')
    assert.equal(warsawLocalToUtc(2026, 10, 27, 9, 0).toISOString(), '2026-10-27T08:00:00.000Z')
  })

  it('parses USOSweb <local-time> strings (the old month heuristic was 1 h off here)', () => {
    assert.equal(warsawLocalStringToUtcIso('2027-03-15 09:00:00'), '2027-03-15T08:00:00.000Z')
    assert.equal(warsawLocalStringToUtcIso('2026-10-29 08:30'), '2026-10-29T07:30:00.000Z')
    assert.equal(warsawLocalStringToUtcIso('2026-09-23 17:00:00'), '2026-09-23T15:00:00.000Z')
    assert.equal(warsawLocalStringToUtcIso('2027-02-12 10:00:00'), '2027-02-12T09:00:00.000Z')
    assert.throws(() => warsawLocalStringToUtcIso('23.09.2026 17:00'))
  })
})
