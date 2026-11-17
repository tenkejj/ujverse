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
