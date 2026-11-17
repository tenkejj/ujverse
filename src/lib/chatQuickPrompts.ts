/**
 * Quick prompts — wspólna lista dla ChatHub, FAB i prewarm.
 * Teksty MUSZĄ być identyczne z fast-path / slash queries (cache key).
 */
export const CHAT_QUICK_PROMPTS = [
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Co mam dziś w planie?',
  'Co mam jutro?',
  'Pokaż zniżki studenckie',
  'Co w Auli?',
] as const

export type ChatQuickPrompt = (typeof CHAT_QUICK_PROMPTS)[number]

/** Public suggestions only: never invite a guest into private plan, Aula or profile data. */
export const PUBLIC_CHAT_QUICK_PROMPTS = [
  'Najnowsze ogłoszenia',
  'Jakie są nadchodzące rejestracje USOS?',
  'Wydarzenia oficjalne',
  'Co potrafisz?',
] as const

/** Each example has a public guide or an existing public information tool. */
export const VERSUS_QUESTION_SUGGESTIONS = [
  { label: 'Stypendium rektora', question: 'Jak dostać stypendium rektora?' },
  { label: 'Akademik', question: 'Jak ubiegać się o akademik?' },
  { label: 'Zapisy w USOS', question: 'Jak zapisać się na przedmioty w USOS?' },
  { label: 'Rejestracje', question: 'Kiedy są najbliższe rejestracje USOS?' },
  { label: 'Komunikaty', question: 'Jakie są najnowsze komunikaty na UJ?' },
  { label: 'Wydarzenia', question: 'Jakie są najbliższe oficjalne wydarzenia na UJ?' },
  { label: 'Formularze', question: 'Gdzie znaleźć oficjalne zasady i formularze stypendium rektora?' },
  { label: 'Biblioteka', question: 'Jak korzystać z Biblioteki Jagiellońskiej?' },
  { label: 'mLegitymacja', question: 'Jak uzyskać mLegitymację?' },
  { label: 'Wsparcie', question: 'Gdzie znaleźć wsparcie psychologiczne na UJ?' },
] as const
