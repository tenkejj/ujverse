/**
 * UJverse — minimalny parser iCalendar (RFC 5545) dla planu zajęć z USOSweb.
 *
 * Skupia się na realistycznym podzbiorze ICS który eksportuje USOS:
 *   - VEVENT bloki (bez VTODO/VFREEBUSY/VALARM — pomijane)
 *   - DTSTART/DTEND z `TZID=Europe/Warsaw` (USOS używa lokalnego czasu)
 *   - DTSTART/DTEND w UTC (`Z` suffix) jako fallback
 *   - SUMMARY / LOCATION / DESCRIPTION / UID / ORGANIZER;CN=...
 *
 * Świadomie NIE robi:
 *   - RRULE expansion (USOSweb eksportuje flat events, jeden VEVENT per
 *     wystąpienie zajęć)
 *   - VTIMEZONE definicje (używamy Intl API do wyliczenia offsetu z TZID)
 *   - X-* extensions, ATTENDEE, RECURRENCE-ID
 *
 * Zero zewnętrznych zależności — `ical.js` to ~150 KB gzip, dla naszego
 * podzbioru ICS overkill.
 */

export type IcsEvent = {
  /** Stabilny identyfikator z `UID:` lub syntetyczny fallback `<start>:<summary>`. */
  uid: string
  summary: string
  /** Nazwisko prowadzącego (z `ORGANIZER;CN=` lub regex z `DESCRIPTION`). */
  lecturer: string | null
  location: string | null
  description: string | null
  startUtc: Date
  endUtc: Date
}

export type IcsParseResult = {
  events: IcsEvent[]
  errors: string[]
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Unfolding linii — RFC 5545 §3.1: kontynuacja przez CRLF + WS              */
/* ────────────────────────────────────────────────────────────────────────── */

function unfoldLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const out: string[] = []
  for (const line of normalized.split('\n')) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (out.length > 0) {
        out[out.length - 1] += line.slice(1)
        continue
      }
    }
    out.push(line)
  }
  return out
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Klucz:wartość z opcjonalnymi parametrami (`KEY;PARAM=VAL:VALUE`)           */
/* ────────────────────────────────────────────────────────────────────────── */

type ParsedLine = {
  key: string
  params: Record<string, string>
  value: string
}

function parseLine(line: string): ParsedLine | null {
  const colon = findUnquotedColon(line)
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)

  const headParts = splitHead(head)
  const key = headParts[0]?.toUpperCase() ?? ''
  if (!key) return null

  const params: Record<string, string> = {}
  for (let i = 1; i < headParts.length; i++) {
    const eq = headParts[i].indexOf('=')
    if (eq < 0) continue
    const pk = headParts[i].slice(0, eq).toUpperCase()
    const pv = stripQuotes(headParts[i].slice(eq + 1))
    params[pk] = pv
  }
  return { key, params, value }
}

/** Pierwsza `:` poza cudzysłowem (`KEY;X="a:b":VAL`). */
function findUnquotedColon(s: string): number {
  let inQuote = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"') inQuote = !inQuote
    else if (c === ':' && !inQuote) return i
  }
  return -1
}

/** Splituje `KEY;P1=v;P2="a;b"` po `;` ignorując średniki w cudzysłowach. */
function splitHead(s: string): string[] {
  const out: string[] = []
  let buf = ''
  let inQuote = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"') inQuote = !inQuote
    if (c === ';' && !inQuote) {
      out.push(buf)
      buf = ''
      continue
    }
    buf += c
  }
  if (buf) out.push(buf)
  return out
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
  return s
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Unescape TEXT (RFC 5545 §3.3.11) — `\n`, `\,`, `\;`, `\\`                 */
/* ────────────────────────────────────────────────────────────────────────── */

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Czas — TZID=Europe/Warsaw vs UTC                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Offset strefy względem UTC dla danej daty (w minutach, dodatni = na wschód).
 * Używa `Intl.DateTimeFormat` z `timeZoneName: 'longOffset'` — działa
 * w Node + browserach modernowych bez bibliotek tz.
 */
function tzOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
      timeZoneName: 'longOffset',
    })
    const parts = fmt.formatToParts(date)
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(tz)
    if (!m) return 0
    const sign = m[1] === '-' ? -1 : 1
    const h = parseInt(m[2], 10) || 0
    const min = m[3] ? parseInt(m[3], 10) : 0
    return sign * (h * 60 + min)
  } catch {
    return 0
  }
}

/**
 * Parsuje `YYYYMMDDTHHMMSS[Z]` + opcjonalny TZID na Date w UTC.
 *
 * - `Z` → traktujemy jako UTC bezpośrednio.
 * - TZID podany → wyliczamy offset Intl dla danej daty, korygujemy.
 * - Brak TZID i bez Z → traktujemy jako UTC (rzadko spotykane w USOS,
 *   ale niezdefiniowane zachowanie ICS — nasz bezpieczny domyślny).
 */
function parseIcsTime(rawValue: string, tzid: string | null): Date | null {
  const value = rawValue.trim()
  // YYYYMMDD (all-day) — pomijamy, nie wspieramy zajęć całodniowych w MVP
  if (/^\d{8}$/.test(value)) return null

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  const hour = parseInt(m[4], 10)
  const min = parseInt(m[5], 10)
  const sec = parseInt(m[6], 10)
  const isUtc = m[7] === 'Z'

  if (isUtc || !tzid) {
    return new Date(Date.UTC(year, month - 1, day, hour, min, sec))
  }

  // Naiwne wyliczenie: traktuj komponenty jak UTC, potem cofnij o offset strefy.
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, min, sec))
  const offset = tzOffsetMinutes(tzid, naiveUtc)
  return new Date(naiveUtc.getTime() - offset * 60_000)
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Ekstraktor wykładowcy                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * USOSweb pakuje prowadzącego w ORGANIZER (`CN=...`) — to najczystsze
 * źródło. Fallback: szuka `Prowadzący: <Imię Nazwisko>` w DESCRIPTION
 * (najbardziej powszechny wzorzec w polskich systemach uczelnianych).
 *
 * Wszystko inne (brak ORGANIZER, brak prefiksu w DESCRIPTION) → NULL,
 * entry zapisuje się bez lecturer_key i nie podlega matchingowi do anonsów.
 */
function extractLecturer(organizerCn: string | null, description: string | null): string | null {
  if (organizerCn) {
    const trimmed = organizerCn.trim()
    if (trimmed.length >= 2) return trimmed
  }
  if (description) {
    const m = /(?:prowadz[ąa]cy|wyk[łl]adowca|nauczyciel)\s*:?\s*([^\n,;]+)/i.exec(description)
    if (m) {
      const trimmed = m[1].trim()
      if (trimmed.length >= 2 && trimmed.length <= 160) return trimmed
    }
  }
  return null
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Główne API                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Parsuje surowy tekst .ics na listę VEVENT-ów (tylko zajęcia z poprawnym
 * DTSTART/DTEND). Błędy per-event NIE wywalają całego parsera — zwracamy
 * `errors[]` dla UI (np. „Pominięto 3 zajęć bez daty").
 */
export function parseIcs(raw: string): IcsParseResult {
  const lines = unfoldLines(raw)
  const events: IcsEvent[] = []
  const errors: string[] = []

  let inEvent = false
  let buf: Record<string, ParsedLine> = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true
      buf = {}
      continue
    }
    if (line.toUpperCase() === 'END:VEVENT') {
      inEvent = false
      const ev = buildEvent(buf, errors)
      if (ev) events.push(ev)
      continue
    }
    if (!inEvent) continue

    const parsed = parseLine(line)
    if (!parsed) continue
    // Multi-line keys (rare in ICS, ale np. wielokrotne ATTENDEE) — w MVP
    // bierzemy ostatni (dla USOSweb to nie ma znaczenia bo wszystko jest single).
    buf[parsed.key] = parsed
  }

  // Sort chronologicznie po starcie — przy importach z różnych semestrów.
  events.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime())

  return { events, errors }
}

function buildEvent(buf: Record<string, ParsedLine>, errors: string[]): IcsEvent | null {
  const dtstart = buf['DTSTART']
  const dtend = buf['DTEND']
  const summaryLine = buf['SUMMARY']
  if (!dtstart || !dtend || !summaryLine) return null

  const startUtc = parseIcsTime(dtstart.value, dtstart.params['TZID'] ?? null)
  const endUtc = parseIcsTime(dtend.value, dtend.params['TZID'] ?? null)
  if (!startUtc || !endUtc || Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    errors.push(`Pominięto zajęcia bez poprawnej daty (${summaryLine.value.slice(0, 60)})`)
    return null
  }
  if (endUtc.getTime() <= startUtc.getTime()) {
    errors.push(`Pominięto zajęcia z odwróconym czasem (${summaryLine.value.slice(0, 60)})`)
    return null
  }

  const summary = unescapeIcsText(summaryLine.value).trim()
  const description = buf['DESCRIPTION'] ? unescapeIcsText(buf['DESCRIPTION'].value) : null
  const location = buf['LOCATION'] ? unescapeIcsText(buf['LOCATION'].value).trim() : null
  const organizerCn = buf['ORGANIZER']?.params['CN'] ?? null
  const lecturer = extractLecturer(organizerCn, description)

  const uidLine = buf['UID']
  const uid = uidLine
    ? uidLine.value.trim()
    : syntheticUid(startUtc, summary)

  return {
    uid,
    summary,
    lecturer,
    location,
    description: description ? description.trim() : null,
    startUtc,
    endUtc,
  }
}

function syntheticUid(start: Date, summary: string): string {
  const ts = start.toISOString().replace(/[^0-9TZ]/g, '')
  const hash = simpleHash(summary)
  return `synthetic-${ts}-${hash}`
}

/** Tani 32-bit FNV-1a — wystarcza do deduplikacji w obrębie jednego usera. */
function simpleHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
