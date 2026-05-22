/**
 * Skrócona etykieta prowadzącego na wąskich pigułkach mobilnych.
 * "Małgorzata Jaskowska" → "M. Jaskowska"
 */
export function formatLecturerPillLabel(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return ''

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]

  const firstInitial = parts[0].charAt(0)
  if (!firstInitial) return parts[parts.length - 1]

  const surname = parts[parts.length - 1]
  return `${firstInitial}. ${surname}`
}
