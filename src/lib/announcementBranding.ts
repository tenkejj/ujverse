/** Krótka etykieta źródła (spójna z `source` w DB). */
export const ACADEMIC_ISI_BADGE_LABEL = 'ISI UJ'

/** Dłuższy opis do atrybutu `title` / podpowiedzi. */
export const ACADEMIC_ISI_BADGE_TITLE = 'Źródło: ISI UJ'

export function showAcademicIsiBadge(source: string | null | undefined): boolean {
  return source === 'ISI UJ' || source == null
}
