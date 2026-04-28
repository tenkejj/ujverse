export function formatXNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0

  if (safeValue >= 1_000_000) {
    const short = safeValue / 1_000_000
    return `${Number.isInteger(short) ? short.toFixed(0) : short.toFixed(1)} mln`
  }

  if (safeValue >= 1_000) {
    const short = safeValue / 1_000
    return `${Number.isInteger(short) ? short.toFixed(0) : short.toFixed(1)} tys.`
  }

  return String(safeValue)
}
