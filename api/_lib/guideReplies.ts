import { STUDENT_GUIDES, needsGuideReview } from '../../src/lib/info/guides.js'

/** Explain a verified procedure without another inference or a guessed obligation. */
export function tryGuideReply(
  question: string,
  now = new Date(),
): string | null {
  const text = question
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
  if (
    text.length > 240 ||
    !/\b(jak|gdzie|poradnik|instrukcj|krok|procedur)/.test(text)
  )
    return null
  const slug = /stypendium rektora/.test(text)
    ? 'stypendium-rektora'
    : /akademik/.test(text)
      ? 'akademik'
      : /rejestrac|zapis.*(?:zajec|przedmiot|grup)|usos/.test(text)
        ? 'rejestracje-usos'
        : null
  const guide = STUDENT_GUIDES.find((entry) => entry.slug === slug)
  if (!guide) return null
  const introduction = needsGuideReview(guide, now)
    ? 'Mam przewodnik, ale jego opis wymaga ponownego sprawdzenia. Potwierdź aktualne zasady w oficjalnym źródle.'
    : `${guide.description}\n\n${guide.steps
        .slice(0, 3)
        .map((step, index) => `${index + 1}. ${step.title}`)
        .join('\n')}`
  return `${introduction}\n\n${guide.deadline}\n\n[Cały poradnik: ${guide.shortTitle}](/poradniki/${guide.slug}) · [Oficjalne zasady UJ](${guide.sources[0].url})\n\nPoradnik dotyczy: ${guide.scope}. Nie składa wniosku ani nie wykonuje czynności w USOS.`
}
