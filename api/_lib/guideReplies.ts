import { STUDENT_GUIDES, needsGuideReview, type GuideSlug } from '../../src/lib/info/guides.js'

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
  const topics: readonly [RegExp, GuideSlug][] = [
    [/stypendium rektora/, 'stypendium-rektora'],
    [/stypendium socjaln/, 'stypendium-socjalne'],
    [/zapomog/, 'zapomoga'],
    [/mlegitymacj|mobywatel|legitymacj.*telefon/, 'mlegitymacja'],
    [/sowa|psycholog|(?:pomoc|wsparc).*psych/, 'wsparcie-psychologiczne'],
    [/(?:dostosowan|adaptacj).*(?:studi|zajec|egzamin)|racjonaln.*usprawn|niepelnosprawn/, 'dostosowanie-studiowania'],
    [/bibliotek|wypozycz.*ksiazk/, 'biblioteka-jagiellonska'],
    [/akademik/, 'akademik'],
    [/rejestrac|zapis.*(?:zajec|przedmiot|grup)|usos/, 'rejestracje-usos'],
  ]
  const slug = topics.find(([pattern]) => pattern.test(text))?.[1]
  const guide = STUDENT_GUIDES.find((entry) => entry.slug === slug)
  if (!guide) return null
  const introduction = needsGuideReview(guide, now)
    ? 'Mam przewodnik, ale jego opis wymaga ponownego sprawdzenia. Potwierdź aktualne zasady w oficjalnym źródle.'
    : `${guide.description}\n\n${guide.steps
        .slice(0, 3)
        .map((step, index) => `${index + 1}. ${step.title}`)
        .join('\n')}`
  return `${introduction}\n\n${guide.deadline}\n\n[Cały poradnik: ${guide.shortTitle}](/poradniki/${guide.slug}) · [Oficjalne zasady UJ](${guide.sources[0].url})\n\nPoradnik dotyczy: ${guide.scope}. Czynności wykonujesz w odpowiednim serwisie UJ.`
}
