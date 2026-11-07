import { useChatStore } from '../store/useChatStore'
import type { VersuActivity } from '../components/chat/VersuMark'

/** Subscribe to phase changes rather than restarting a sprite for every streamed token. */
export function useVersuActivity(isComposing = false): VersuActivity {
  const phase = useChatStore((state) => state.responsePhase)
  const hasMessages = useChatStore((state) => state.messages.length > 0)
  if (phase === 'thinking' || phase === 'answering' || phase === 'error')
    return phase
  if (isComposing) return 'listening'
  if (phase === 'success') return 'success'
  return hasMessages ? 'idle' : 'greeting'
}
