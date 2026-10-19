/**
 * UJverse — parser planu zajęć z arkusza (.xlsx, .xls, .csv).
 *
 * Obsługiwane formaty:
 *   - Eksport CSV USOSweb → Google Calendar (Subject, Start Date, Start Time, …)
 *   - Ręczne arkusze z polskimi nagłówkami (Przedmiot, Data, Godzina, …)
 *   - Ogólne kolumny daty+czasu w jednej komórce
 *
 * Zwraca ten sam kształt co `parseIcs` (`IcsEvent`) — adapter zapisuje
 * oba źródła do `user_timetable_entries`.
 */
import * as XLSX from 'xlsx'
import type { IcsEvent, IcsParseResult } from './icsParser'
import { warsawLocalToUtc } from './warsawTime'

type ColumnMap = {
  summary: number
  startDate: number | null
  startTime: number | null
  endDate: number | null
  endTime: number | null
  startDateTime: number | null
  endDateTime: number | null
  lecturer: number | null
  location: number | null
  description: number | null
}

const SUMMARY_HEADERS = [
  'subject',
  'przedmiot',
  'nazwa zajęć',
  'nazwa zajec',
  'zajęcia',
  'zajecia',
  'temat',
  'nazwa',
  'tytuł',
  'tytul',
  'course',
  'course name',
  'summary',
  'nazwa przedmiotu',
]

const START_DATE_HEADERS = [
  'start date',
  'data rozpoczęcia',
  'data rozpoczecia',
  'data',
  'dzień',
  'dzien',
  'date',
]

const START_TIME_HEADERS = [
  'start time',
  'godzina rozpoczęcia',
  'godzina rozpoczecia',
  'godzina',
  'od',
  'początek',
  'poczatek',
  'start',
]

const END_DATE_HEADERS = ['end date', 'data zakończenia', 'data zakonczenia']

const END_TIME_HEADERS = [
  'end time',
  'godzina zakończenia',
  'godzina zakonczenia',
  'do',
  'koniec',
  'end',
]

const START_DATETIME_HEADERS = [
  'data i godzina rozpoczęcia',
  'data i godzina rozpoczecia',
  'start',
  'początek zajęć',
  'poczatek zajec',
  'datetime start',
  'dtstart',
]

const END_DATETIME_HEADERS = [
  'data i godzina zakończenia',
  'data i godzina zakonczenia',
  'koniec zajęć',
  'koniec zajec',
  'datetime end',
  'dtend',
]

const LECTURER_HEADERS = [
  'prowadzący',
  'prowadzacy',
  'wykładowca',
  'wykladowca',
  'nauczyciel',
  'lecturer',
  'organizer',
  'lista prowadzących',
  'lista prowadzacych',
]

const LOCATION_HEADERS = [
  'location',
  'lokalizacja',
  'miejsce',
  'sala',
  'nr sali',
  'numer sali',
  'budynek',
  'room',
]

const DESCRIPTION_HEADERS = ['description', 'opis', 'uwagi', 'notatki']

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function findColumn(headers: string[], aliases: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (!h) continue
    if (aliases.some((a) => h === a || h.includes(a))) return i
  }
  return null
}

function detectColumns(headers: string[]): ColumnMap | null {
  const summary = findColumn(headers, SUMMARY_HEADERS)
  if (summary == null) return null

  return {
    summary,
    startDate: findColumn(headers, START_DATE_HEADERS),
    startTime: findColumn(headers, START_TIME_HEADERS),
    endDate: findColumn(headers, END_DATE_HEADERS),
    endTime: findColumn(headers, END_TIME_HEADERS),
    startDateTime: findColumn(headers, START_DATETIME_HEADERS),
    endDateTime: findColumn(headers, END_DATETIME_HEADERS),
    lecturer: findColumn(headers, LECTURER_HEADERS),
    location: findColumn(headers, LOCATION_HEADERS),
    description: findColumn(headers, DESCRIPTION_HEADERS),
  }
}

function cellText(row: unknown[], index: number | null): string | null {
  if (index == null || index < 0 || index >= row.length) return null
  const raw = row[index]
  if (raw == null || raw === '') return null
  return String(raw).trim() || null
}

type ExcelWallParts = {
  y: number
  m: number
  d: number
  H: number
  M: number
  S: number
}

/** Excel serial → naiwne komponenty kalendarza (bez strefy). */
function excelSerialToWallParts(serial: number): ExcelWallParts | null {
  if (!Number.isFinite(serial) || serial < 1) return null
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed) return null
  return {
    y: parsed.y,
    m: parsed.m,
    d: parsed.d,
    H: parsed.H,
    M: parsed.M,
    S: parsed.S,
  }
}

/**
 * Excel serial = naiwny zegar lokalny (bez strefy). Wcześniej `Date.UTC(...)`
 * zapisywał 11:30 jako 11:30Z → w Warszawie wyświetlane 13:30 (+2 h CEST).
 */
function excelSerialToDate(serial: number): Date | null {
  const parsed = excelSerialToWallParts(serial)
  if (!parsed) return null
  return warsawLocalToUtc(
    parsed.y,
    parsed.m,
    parsed.d,
    parsed.H,
    parsed.M,
    Math.floor(parsed.S),
  )
}

function parsePolishDateParts(text: string): { year: number; month: number; day: number } | null {
  const t = text.trim()

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return { year: +m[1], month: +m[2], day: +m[3] }

  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    const year = +m[3]
    // DD.MM.YYYY (PL) vs MM/DD/YYYY (Google CSV) — heurystyka: >12 = dzień
    if (a > 12) return { year, month: b, day: a }
    if (b > 12) return { year, month: a, day: b }
    // Ambiguous — preferuj europejski DD.MM
    return { year, month: b, day: a }
  }

  return null
}

function parseTimeParts(text: string): { hour: number; minute: number } | null {
  const t = text.trim()

  let m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t)
  if (m) return { hour: +m[1], minute: +m[2] }

  m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t)
  if (m) {
    let hour = +m[1]
    const minute = +m[2]
    const pm = m[3].toUpperCase() === 'PM'
    if (pm && hour < 12) hour += 12
    if (!pm && hour === 12) hour = 0
    return { hour, minute }
  }

  return null
}

function parseDateTimeValue(raw: unknown): Date | null {
  if (raw == null || raw === '') return null

  if (typeof raw === 'number') {
    const fromSerial = excelSerialToDate(raw)
    if (fromSerial) return fromSerial
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw

  const text = String(raw).trim()
  if (!text) return null

  // ISO z offsetem / Z — bierzemy absolutny moment.
  if (/[Tt ]\d{1,2}:\d{2}/.test(text) && /(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const abs = Date.parse(text)
    if (!Number.isNaN(abs)) return new Date(abs)
  }

  // ISO / „YYYY-MM-DD HH:MM" BEZ strefy → zegar Warszawy (nie lokalne TZ hosta).
  const naiveIso =
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text)
  if (naiveIso) {
    return warsawLocalToUtc(
      +naiveIso[1],
      +naiveIso[2],
      +naiveIso[3],
      +naiveIso[4],
      +naiveIso[5],
      naiveIso[6] ? +naiveIso[6] : 0,
    )
  }

  // "DD.MM.YYYY HH:MM" lub "DD/MM/YYYY HH:MM"
  const dt = /^(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i.exec(
    text,
  )
  if (dt) {
    const dateParts = parsePolishDateParts(dt[1])
    const timeParts = parseTimeParts(dt[2])
    if (dateParts && timeParts) {
      return warsawLocalToUtc(
        dateParts.year,
        dateParts.month,
        dateParts.day,
        timeParts.hour,
        timeParts.minute,
      )
    }
  }

  const dateOnly = parsePolishDateParts(text)
  if (dateOnly) {
    return warsawLocalToUtc(dateOnly.year, dateOnly.month, dateOnly.day, 0, 0)
  }

  return null
}

function combineDateAndTime(dateRaw: unknown, timeRaw: unknown): Date | null {
  if (typeof dateRaw === 'number') {
    const wall = excelSerialToWallParts(dateRaw)
    if (wall && timeRaw != null && timeRaw !== '') {
      const timeParts = parseTimeParts(String(timeRaw))
      if (timeParts) {
        return warsawLocalToUtc(
          wall.y,
          wall.m,
          wall.d,
          timeParts.hour,
          timeParts.minute,
        )
      }
    }
    if (wall) {
      return warsawLocalToUtc(wall.y, wall.m, wall.d, wall.H, wall.M, Math.floor(wall.S))
    }
  }

  const dateText = dateRaw != null ? String(dateRaw).trim() : ''
  const timeText = timeRaw != null ? String(timeRaw).trim() : ''

  if (!dateText) return null

  const dateParts = parsePolishDateParts(dateText)
  if (!dateParts) {
    return parseDateTimeValue(dateRaw)
  }

  const timeParts = timeText ? parseTimeParts(timeText) : { hour: 0, minute: 0 }
  if (!timeParts) return null

  return warsawLocalToUtc(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
  )
}

function extractLecturerFromDescription(description: string | null): string | null {
  if (!description) return null
  const m = /(?:prowadz[ąa]cy|wyk[łl]adowca|nauczyciel)\s*:?\s*([^\n,;]+)/i.exec(description)
  if (!m) return null
  const trimmed = m[1].trim()
  return trimmed.length >= 2 && trimmed.length <= 160 ? trimmed : null
}

function syntheticUid(start: Date, summary: string): string {
  const ts = start.toISOString().replace(/[^0-9TZ]/g, '')
  let h = 0x811c9dc5
  for (let i = 0; i < summary.length; i++) {
    h ^= summary.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return `excel-${ts}-${h.toString(16).padStart(8, '0')}`
}

function parseRow(
  row: unknown[],
  cols: ColumnMap,
  rowNum: number,
  errors: string[],
): IcsEvent | null {
  const summary = cellText(row, cols.summary)
  if (!summary) return null

  const skipPatterns = [
    /^subject$/i,
    /^przedmiot$/i,
    /^temat$/i,
    /^start date$/i,
    /^data$/i,
  ]
  if (skipPatterns.some((p) => p.test(summary))) return null

  let startUtc: Date | null = null
  let endUtc: Date | null = null

  if (cols.startDateTime != null) {
    startUtc = parseDateTimeValue(row[cols.startDateTime])
  } else if (cols.startDate != null) {
    startUtc = combineDateAndTime(row[cols.startDate], cols.startTime != null ? row[cols.startTime] : null)
  }

  if (cols.endDateTime != null) {
    endUtc = parseDateTimeValue(row[cols.endDateTime])
  } else if (cols.endDate != null || cols.endTime != null) {
    const endDateRaw = cols.endDate != null ? row[cols.endDate] : row[cols.startDate ?? -1]
    const endTimeRaw = cols.endTime != null ? row[cols.endTime] : null
    endUtc = combineDateAndTime(endDateRaw, endTimeRaw)
  }

  if (!startUtc || Number.isNaN(startUtc.getTime())) {
    errors.push(`Wiersz ${rowNum}: brak daty rozpoczęcia (${summary.slice(0, 40)})`)
    return null
  }

  if (!endUtc || Number.isNaN(endUtc.getTime())) {
    // Domyślnie 1,5 h zajęć gdy brak końca (typowy slot USOS)
    endUtc = new Date(startUtc.getTime() + 90 * 60_000)
  }

  if (endUtc.getTime() <= startUtc.getTime()) {
    errors.push(`Wiersz ${rowNum}: niepoprawny zakres czasu (${summary.slice(0, 40)})`)
    return null
  }

  const description = cellText(row, cols.description)
  const lecturerRaw = cellText(row, cols.lecturer)
  const lecturer = lecturerRaw ?? extractLecturerFromDescription(description)
  const location = cellText(row, cols.location)

  return {
    uid: syntheticUid(startUtc, summary),
    summary,
    lecturer,
    location,
    description,
    startUtc,
    endUtc,
  }
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]
}

function findHeaderRow(matrix: unknown[][]): { headerIndex: number; cols: ColumnMap } | null {
  const limit = Math.min(matrix.length, 25)
  for (let i = 0; i < limit; i++) {
    const row = matrix[i]
    if (!Array.isArray(row)) continue
    const headers = row.map((c) => normalizeHeader(c))
    const cols = detectColumns(headers)
    if (cols) return { headerIndex: i, cols }
  }
  return null
}

function parseMatrix(matrix: unknown[][]): IcsParseResult {
  const events: IcsEvent[] = []
  const errors: string[] = []

  const header = findHeaderRow(matrix)
  if (!header) {
    errors.push(
      'Nie znaleziono nagłówków — arkusz musi mieć kolumnę „Przedmiot” lub „Subject” oraz datę/godzinę.',
    )
    return { events, errors }
  }

  for (let i = header.headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i]
    if (!Array.isArray(row) || row.every((c) => c == null || c === '')) continue
    const ev = parseRow(row, header.cols, i + 1, errors)
    if (ev) events.push(ev)
  }

  events.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime())
  return { events, errors }
}

/**
 * Parsuje bufor pliku .xlsx / .xls / .csv na listę zajęć.
 */
export function parseSpreadsheetTimetable(data: ArrayBuffer): IcsParseResult {
  const errors: string[] = []
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: true })
  } catch {
    return {
      events: [],
      errors: ['Nie udało się odczytać pliku — sprawdź czy to poprawny Excel lub CSV.'],
    }
  }

  if (!workbook.SheetNames.length) {
    return { events: [], errors: ['Plik nie zawiera arkuszy.'] }
  }

  let best: IcsParseResult = { events: [], errors: [] }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const matrix = sheetToMatrix(sheet)
    const result = parseMatrix(matrix)
    if (result.events.length > best.events.length) {
      best = result
    }
  }

  if (best.events.length === 0 && best.errors.length === 0) {
    errors.push(
      'Nie znaleziono zajęć — użyj eksportu CSV z USOSweb (semestr) lub arkusza z kolumnami: Przedmiot, Data, Godzina.',
    )
    return { events: [], errors }
  }

  return best
}
