/** Bound requests independently of UI pagination controls. */
export function boundedSearchLimit(
  value: number | undefined,
  fallback = 20,
): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(50, Math.floor(value!)))
}

/** Hidden or banned profiles must not reappear through database search. */
export function canShowSearchProfile(profile: {
  is_searchable?: boolean | null
  is_banned?: boolean | null
}): boolean {
  return profile.is_searchable === true && profile.is_banned !== true
}

export function visibleSearchDepartment(profile: {
  department?: string | null
  show_department?: boolean | null
}): string | null {
  return profile.show_department === true ? (profile.department ?? null) : null
}
