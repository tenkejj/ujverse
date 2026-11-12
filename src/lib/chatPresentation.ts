/** Frontend reading rhythm only; these values are not model tokens/second. */
export const CHAT_REVEAL_FRAME_MS = 50
export const CHAT_REVEAL_CHARACTERS_PER_SECOND = 60
export const CHAT_MAX_REVEAL_LAG_MS = 2200

export function chatPresentationWindow(characterCount: number): number {
  if (characterCount <= 0) return 0
  return Math.min(
    CHAT_MAX_REVEAL_LAG_MS,
    Math.max(
      160,
      Math.ceil((characterCount * 1000) / CHAT_REVEAL_CHARACTERS_PER_SECOND),
    ),
  )
}

/** Subscribe directly so changing the OS preference also updates an open reply. */
export function readSystemChatReducedMotion(): boolean {
  return typeof window === 'undefined'
    ? true
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
export function subscribeSystemChatReducedMotion(
  listener: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
