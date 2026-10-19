/**
 * UJverse — konwersja czasu lokalnego Europe/Warsaw ↔ UTC.
 *
 * Używane przy imporcie planu (ICS / Excel): zajęcia w USOS są podawane
 * jako zegar warszawski; w DB trzymamy TIMESTAMPTZ (UTC).
 */

export const WARSAW_TZ = 'Europe/Warsaw'

/**
 * Offset strefy względem UTC w minutach (dodatni = na wschód).
 * Najpierw `longOffset` / `shortOffset`; fallback liczy różnicę przez
 * formatowanie komponentów (działa gdy `timeZoneName` nie jest wspierane).
 */
export function tzOffsetMinutes(timeZone: string, date: Date): number {
  const normalized = normalizeTimeZoneId(timeZone)
  for (const timeZoneName of ['longOffset', 'shortOffset'] as const) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: normalized,
        hour: '2-digit',
        hour12: false,
        timeZoneName,
      })
      const parts = fmt.formatToParts(date)
      const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
      const m = /(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tz)
      if (m) {
        const sign = m[1] === '-' ? -1 : 1
        const h = parseInt(m[2], 10) || 0
        const min = m[3] ? parseInt(m[3], 10) : 0
        return sign * (h * 60 + min)
      }
    } catch {
      // spróbuj kolejnej strategii
    }
  }

  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: normalized,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const parts = Object.fromEntries(
      dtf
        .formatToParts(date)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    return Math.round((asUtc - date.getTime()) / 60_000)
  } catch {
    return 0
  }
}

/**
 * Normalizuje TZID z ICS (cudzysłowy, wiodący `/` z Outlooka, trim)
 * i mapuje typowe Windows TZ na IANA. Nieznane → Europe/Warsaw
 * (plan UJ jest zawsze w PL — bezpieczniejsze niż traktowanie jako UTC).
 */
export function normalizeTimeZoneId(tzid: string | null | undefined): string {
  if (!tzid) return WARSAW_TZ
  let t = tzid.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  if (t.startsWith('/')) t = t.slice(1)
  const lower = t.toLowerCase()
  if (
    lower === 'europe/warsaw' ||
    lower === 'poland' ||
    lower === 'cet' ||
    lower === 'cest' ||
    lower.includes('central european')
  ) {
    return WARSAW_TZ
  }
  try {
    // Walidacja — Intl rzuci na nieznanej strefie.
    Intl.DateTimeFormat('en-US', { timeZone: t }).format(new Date())
    return t
  } catch {
    return WARSAW_TZ
  }
}

/** Komponenty zegara lokalnego (Warsaw) → absolutny moment UTC. */
export function warsawLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = tzOffsetMinutes(WARSAW_TZ, naiveUtc)
  return new Date(naiveUtc.getTime() - offset * 60_000)
}

/**
 * Naprawia błędnie zapisany czas: komponenty UTC były w rzeczywistości
 * lokalnym zegarem Warszawy (klasyczny bug `Date.UTC(localParts)` /
 * floating ICS jako UTC).
 */
export function reinterpretUtcWallAsWarsawLocal(storedAsUtc: Date): Date {
  return warsawLocalToUtc(
    storedAsUtc.getUTCFullYear(),
    storedAsUtc.getUTCMonth() + 1,
    storedAsUtc.getUTCDate(),
    storedAsUtc.getUTCHours(),
    storedAsUtc.getUTCMinutes(),
    storedAsUtc.getUTCSeconds(),
  )
}
