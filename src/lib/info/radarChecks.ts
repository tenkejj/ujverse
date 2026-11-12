/** Device-only acknowledgement; this never records a USOS operation or completed formalities. */
export const RADAR_CHECKS_KEY = 'ujverse.radarChecks.v1'
export type RadarChecks = Readonly<Record<string, string>>
const MAX_CHECKS = 100

export function parseRadarChecks(raw: string | null): RadarChecks {
  if (!raw || raw.length > 30_000) return {}
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; entries?: unknown }
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries))
      return {}
    const entries: [string, string][] = []
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue
      const [key, checkedAt] = entry
      if (
        typeof key !== 'string' ||
        !/^(registration|announcement):[^\s]{1,250}:[a-z0-9]+$/.test(key)
      )
        continue
      if (
        typeof checkedAt !== 'string' ||
        !Number.isFinite(Date.parse(checkedAt))
      )
        continue
      entries.push([key, checkedAt])
    }
    return Object.fromEntries(entries.slice(-MAX_CHECKS))
  } catch {
    return {}
  }
}

export function serializeRadarChecks(checks: RadarChecks): string {
  return JSON.stringify({
    version: 1,
    entries: Object.entries(checks).slice(-MAX_CHECKS),
  })
}

export function withRadarCheck(
  checks: RadarChecks,
  key: string,
  checked: boolean,
  now = new Date(),
): RadarChecks {
  const next = { ...checks }
  delete next[key]
  if (checked) next[key] = now.toISOString()
  return Object.fromEntries(Object.entries(next).slice(-MAX_CHECKS))
}
