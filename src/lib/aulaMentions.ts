/**
 * Wspólne narzędzia do parsowania @mentions w wiadomościach Auli.
 *
 * Username pattern jest zgodny z USERNAME_PATTERN w `src/components/auth/Login.tsx`
 * (`/^[a-z0-9._-]+$/i`) i z trigerem SQL `handle_cohort_message_mention_notifications`.
 *
 * Mention liczy się tylko jeśli `@` jest na początku tekstu lub po whitespace
 * — nie chcemy łapać adresów email (`foo@bar.com`).
 */

/** Globalny regex z grupą capture na username. Trzymamy literal — flag g + i. */
export const MENTION_REGEX = /(?:^|\s)@([a-z0-9._-]+)/gi

/** Unikalne lowercased usernamey z treści wiadomości. */
export function extractMentions(content: string): string[] {
  if (!content) return []
  // Tworzymy nową instancję regex żeby uniknąć problemów ze stateful `lastIndex`.
  const re = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  const seen = new Set<string>()
  for (const match of content.matchAll(re)) {
    const u = match[1]?.toLowerCase()
    if (u) seen.add(u)
  }
  return Array.from(seen)
}

/**
 * Trigger autocomplete'a w composerze.
 *
 * Patrzymy WSTECZ od pozycji kursora i sprawdzamy czy ostatni token
 * (od ostatniego whitespace) zaczyna się od `@`. Jeśli tak — zwracamy:
 *   - `query` (treść po `@`, lowercased, może być pusta gdy ktoś dopiero
 *     wpisał sam `@`)
 *   - `start` (indeks `@` w pełnym tekście — pozwala na czyste podstawienie)
 *
 * Zwracamy `null` jeśli:
 *   - przed `@` jest dowolny znak nie-whitespace (czyli to email/wewnątrz słowa)
 *   - `query` zawiera znaki spoza patternu username (czyli już nie jesteśmy w trygerze)
 *
 * Uwaga: dopuszczamy pustą `query` żeby pokazać dropdown zaraz po wpisaniu `@`.
 */
export function findMentionTrigger(
  textBeforeCursor: string,
): { query: string; start: number } | null {
  if (!textBeforeCursor) return null

  // Ostatni `@` w prefiksie.
  const atIndex = textBeforeCursor.lastIndexOf('@')
  if (atIndex === -1) return null

  // Sprawdź czy znak przed `@` to BOL lub whitespace.
  if (atIndex > 0) {
    const prev = textBeforeCursor[atIndex - 1]
    if (prev !== undefined && !/\s/.test(prev)) return null
  }

  const query = textBeforeCursor.slice(atIndex + 1)
  // Pusta query OK. Pełna query musi pasować do username pattern.
  if (query.length > 0 && !/^[a-z0-9._-]+$/i.test(query)) return null

  return { query: query.toLowerCase(), start: atIndex }
}
