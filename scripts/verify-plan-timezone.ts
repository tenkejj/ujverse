import { parseIcs } from '../src/lib/icsParser'
import {
  normalizeTimeZoneId,
  reinterpretUtcWallAsWarsawLocal,
  warsawLocalToUtc,
} from '../src/lib/warsawTime'

function warsawHm(d: Date): string {
  return d.toLocaleTimeString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const cases: Array<[string, string]> = [
  [
    'floating',
    `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1
DTSTART:20261020T113000
DTEND:20261020T130000
SUMMARY:A
END:VEVENT
END:VCALENDAR`,
  ],
  [
    'tzid',
    `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:2
DTSTART;TZID=Europe/Warsaw:20261020T113000
DTEND;TZID=Europe/Warsaw:20261020T130000
SUMMARY:A
END:VEVENT
END:VCALENDAR`,
  ],
  [
    'slash',
    `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:3
DTSTART;TZID=/Europe/Warsaw:20261020T113000
DTEND;TZID=/Europe/Warsaw:20261020T130000
SUMMARY:A
END:VEVENT
END:VCALENDAR`,
  ],
  [
    'Z-true-utc',
    `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:4
DTSTART:20261020T093000Z
DTEND:20261020T110000Z
SUMMARY:A
END:VEVENT
END:VCALENDAR`,
  ],
]

let failed = 0
for (const [name, raw] of cases) {
  const e = parseIcs(raw).events[0]
  const hm = warsawHm(e.startUtc)
  const ok = hm === '11:30'
  console.log(name, e.startUtc.toISOString(), '→', hm, ok ? 'OK' : 'FAIL')
  if (!ok) failed++
}

const fixed = reinterpretUtcWallAsWarsawLocal(new Date('2026-10-20T11:30:00.000Z'))
console.log('repair', fixed.toISOString(), warsawHm(fixed), warsawHm(fixed) === '11:30' ? 'OK' : 'FAIL')
if (warsawHm(fixed) !== '11:30') failed++

console.log('normalize slash', normalizeTimeZoneId('/Europe/Warsaw'))
console.log('winter', warsawLocalToUtc(2026, 12, 15, 11, 30).toISOString())

process.exit(failed ? 1 : 0)
