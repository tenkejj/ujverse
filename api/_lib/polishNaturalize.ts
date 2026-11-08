/** Preserve meaning and Markdown. Tone belongs in the prompt, not regex rewrites. */
export function softenTranslationese(text: string): string {
  // Do not collapse newlines (paragraphs/lists) or strip uncertainty/source phrases.
  // Even spaces can be significant inside code or a quoted source.
  return text.trim()
}
