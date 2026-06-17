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
