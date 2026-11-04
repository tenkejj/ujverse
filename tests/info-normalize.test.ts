import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dedupeAnnouncements,
  dedupeEvents,
  dedupeRegistrations,
  latestIso,
  makeExcerpt,
  normalizeAnnouncement,
  normalizeOfficialEvent,
  normalizeRegistration,
  normalizeRows,
} from '../src/lib/info/normalize.ts'
import type { InfoAnnouncement, InfoEvent } from '../src/lib/info/types.ts'

const liferayRow = {
  id: 'a1',
  department: 'Wydział Prawa i Administracji',
  source: 'Portal WPiA UJ',
  source_kind: 'liferay',
  source_url: 'https://wpia.uj.edu.pl/dla-studentow/komunikaty/-/journal_content/1',
  title: 'Zmiana terminu egzaminu z prawa rzymskiego',
  lecturer_name: 'Komunikat wydziałowy',
  body: 'Egzamin odbędzie się 20 listopada w auli.',
  status: 'info',
  created_at: '2026-11-03T08:00:00Z',
  summary: null,
}

const isiRow = {
  id: 'a2',
  department: 'WZiKS',
  source: 'ISI UJ',
  source_kind: 'isi_drupal',
  source_url: null,
  title: null,
  lecturer_name: 'dr Jan Kowalski',
  body: 'Zajęcia w dniu 5.11 są odwołane.',
  status: 'cancelled',
  created_at: '2026-11-04T07:00:00Z',
  summary: 'Zajęcia odwołane.',
}

describe('normalizeAnnouncement', () => {
  it('uses the parser title and the article link for faculty announcements', () => {
    const a = normalizeAnnouncement(liferayRow)
    assert.ok(a)
    assert.equal(a.title, 'Zmiana terminu egzaminu z prawa rzymskiego')
    assert.equal(a.sourceIsListing, false)
    assert.equal(a.sourceUrl, liferayRow.source_url)
    assert.equal(a.facultyShort, 'WP')
    assert.equal(a.lecturerName, null)
    assert.equal(a.mayHaveFullBody, true)
    assert.equal(a.addedAt, '2026-11-03T08:00:00.000Z')
  })

  it('falls back to the lecturer name and the faculty listing page for ISI rows', () => {
    const a = normalizeAnnouncement(isiRow)
    assert.ok(a)
    assert.equal(a.title, 'Jan Kowalski')
    assert.equal(a.faculty, 'Wydział Zarządzania i Komunikacji Społecznej')
    assert.equal(a.sourceUrl, 'https://isi.uj.edu.pl/studenci/news/komunikaty')
    assert.equal(a.sourceIsListing, true)
    assert.equal(a.status, 'cancelled')
  })

  it('never renders unsafe links', () => {
    const a = normalizeAnnouncement({ ...liferayRow, source_url: 'javascript:alert(1)' })
    assert.ok(a)
    assert.equal(a.sourceUrl, 'https://wpia.uj.edu.pl/dla-studentow/komunikaty')
    assert.equal(a.sourceIsListing, true)
  })

  it('uses the body when neither title nor a real lecturer exists', () => {
    const a = normalizeAnnouncement({ ...liferayRow, title: null })
    assert.ok(a)
    assert.equal(a.title, 'Egzamin odbędzie się 20 listopada w auli.')
  })

  it('rejects rows without required metadata', () => {
    assert.equal(normalizeAnnouncement({ ...liferayRow, status: 'urgent' }), null)
    assert.equal(normalizeAnnouncement({ ...liferayRow, created_at: 'not a date' }), null)
    assert.equal(normalizeAnnouncement({ ...liferayRow, id: null }), null)
    assert.equal(normalizeAnnouncement({ ...liferayRow, body: undefined }), null)
  })

  it('keeps an unknown department as "no faculty" instead of crashing', () => {
    const a = normalizeAnnouncement({ ...liferayRow, department: 'Wydział Magii', source_url: null })
    assert.ok(a)
    assert.equal(a.faculty, null)
    assert.equal(a.sourceUrl, null)
  })
})

const registrationRow = {
  id: 'r1',
  title: 'Rejestracja na przedmioty fakultatywne — II tura',
  description: 'Kod rejestracji USOSweb: WSM.KU-26/27L-fak',
  audience_label: 'Zakład Studiów Polsko-Ukraińskich',
  opens_at: '2026-10-31T06:00:00+00:00',
  closes_at: '2026-11-06T11:00:00+00:00',
  registration_url: 'https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/rejestracjaTury&rej_kod=X',
  kind: 'obieralne',
  source_usos_tura_id: '45118',
  source_unit_code: 'UJ.WSM.KU',
  updated_at: '2026-11-04T19:58:47.181505+00:00',
}

describe('normalizeRegistration', () => {
  it('derives faculty, code and keeps the USOSweb link', () => {
    const r = normalizeRegistration(registrationRow)
    assert.ok(r)
    assert.equal(r.faculty, 'Wydział Studiów Międzynarodowych i Politycznych')
    assert.equal(r.code, 'WSM.KU-26/27L-fak')
    assert.equal(r.url, registrationRow.registration_url)
    assert.equal(r.verifiedAt, '2026-11-04T19:58:47.181Z')
  })

  it('excludes rows that are not from the USOSweb scraper (seed / community)', () => {
    assert.equal(normalizeRegistration({ ...registrationRow, source_usos_tura_id: null }), null)
  })

  it('rejects inconsistent dates and keeps open-ended registrations', () => {
    assert.equal(normalizeRegistration({ ...registrationRow, closes_at: '2026-10-01T00:00:00Z' }), null)
    assert.equal(normalizeRegistration({ ...registrationRow, closes_at: 'garbage' }), null)
    assert.equal(normalizeRegistration({ ...registrationRow, closes_at: null })?.closesAt, null)
  })

  it('falls back to the unit catalogue when the stored link is unusable', () => {
    const r = normalizeRegistration({ ...registrationRow, registration_url: 'ftp://x' })
    assert.ok(r)
    assert.match(r.url ?? '', /jed_org_kod=UJ\.WSM\.KU/)
  })
})

const eventRow = {
  id: 'e1',
  external_id: 'uj:10172/161757',
  title: 'III Festiwal Miejsc i Podróży GEOGRAFICA',
  date: '2026-11-21T12:00:00+00:00',
  category: 'Oficjalne',
  location: 'Uniwersytet Jagielloński, Kraków',
  description: 'Treść z oficjalnego serwisu UJ.',
  faculty: 'Uniwersytet Jagielloński',
  source_name: 'Uniwersytet Jagielloński',
  event_url: 'https://www.uj.edu.pl/kalendarz/-/journal_content/56_INSTANCE_5De61CKaqzOl/10172/161755363',
  image_url: null,
  scraped_at: '2026-11-04T05:10:08.294+00:00',
}

describe('normalizeOfficialEvent', () => {
  it('hides placeholder location/description and keeps the Warsaw day', () => {
    const e = normalizeOfficialEvent(eventRow)
    assert.ok(e)
    assert.equal(e.location, null)
    assert.equal(e.description, '')
    assert.equal(e.category, null)
    assert.equal(e.dayKey, '2026-11-21')
  })

  it('drops news articles and events whose date is just the scrape time', () => {
    assert.equal(normalizeOfficialEvent({ ...eventRow, event_url: 'https://www.uj.edu.pl/wiadomosci/-/journal_content/x' }), null)
    assert.equal(normalizeOfficialEvent({ ...eventRow, date: '2026-11-04T05:09:30Z' }), null)
  })

  it('keeps a real location', () => {
    assert.equal(normalizeOfficialEvent({ ...eventRow, location: 'Auditorium Maximum' })?.location, 'Auditorium Maximum')
  })
})

describe('deduplication', () => {
  const base = normalizeAnnouncement(liferayRow) as InfoAnnouncement

  it('merges the same article fetched twice, keeping the earliest', () => {
    const later = { ...base, id: 'a1-dup', addedAt: '2026-11-04T08:00:00.000Z', sourceUrl: `${base.sourceUrl}/#top` }
    const out = dedupeAnnouncements([later, base])
    assert.equal(out.length, 1)
    assert.equal(out[0].id, 'a1')
  })

  it('does not merge different announcements with similar titles', () => {
    const other = {
      ...base,
      id: 'a3',
      title: 'Zmiana terminu egzaminu z prawa rzymskiego (grupa 2)',
      sourceUrl: 'https://wpia.uj.edu.pl/dla-studentow/komunikaty/-/journal_content/2',
    }
    assert.equal(dedupeAnnouncements([base, other]).length, 2)
  })

  it('never merges items that only share a listing page', () => {
    const isi = normalizeAnnouncement(isiRow) as InfoAnnouncement
    const isi2 = { ...isi, id: 'a4', title: 'Dr Anna Nowak' }
    assert.equal(dedupeAnnouncements([isi, isi2]).length, 2)
  })

  it('merges events with the same title on the same day only', () => {
    const e = normalizeOfficialEvent(eventRow) as InfoEvent
    const sameDay = { ...e, id: 'e2', externalId: 'uj:other' }
    const otherDay = { ...e, id: 'e3', externalId: 'uj:third', dayKey: '2026-11-22' }
    const out = dedupeEvents([e, sameDay, otherDay])
    assert.deepEqual(out.map((x) => x.id), ['e1', 'e3'])
  })

  it('dedupes registrations by USOS tura id', () => {
    const r = normalizeRegistration(registrationRow)
    assert.ok(r)
    assert.equal(dedupeRegistrations([r, { ...r, id: 'r2' }]).length, 1)
  })
})

describe('helpers', () => {
  it('cuts excerpts at word boundaries', () => {
    const text = 'słowo '.repeat(80)
    const out = makeExcerpt(text, 50)
    assert.ok(out.length <= 51)
    assert.ok(out.endsWith('…'))
    assert.doesNotMatch(out, /słow…$/)
  })

  it('skips malformed rows when normalising lists', () => {
    const rows = [liferayRow, null, 42, { id: 'x' }]
    assert.equal(normalizeRows(rows, normalizeAnnouncement).length, 1)
    assert.deepEqual(normalizeRows('not an array', normalizeAnnouncement), [])
  })

  it('finds the latest timestamp by value', () => {
    assert.equal(
      latestIso(['2026-11-04T19:58:47+00:00', null, '2026-11-04T20:00:00Z', 'bad']),
      '2026-11-04T20:00:00.000Z',
    )
    assert.equal(latestIso([]), null)
  })
})
