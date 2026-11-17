import { lazy, Suspense, useState } from 'react'
import type { ChatAssistantFabProps } from './ChatAssistantFab'

const ChatAssistantFab = lazy(() => import('./ChatAssistantFab'))

/** Load on first use, then retain the draft and streaming lifecycle while hidden. */
export default function DeferredChatAssistantFab(props: ChatAssistantFabProps) {
  const [hasBeenVisible, setHasBeenVisible] = useState(!props.hidden)

  if (!props.hidden && !hasBeenVisible) setHasBeenVisible(true)
  if (props.hidden && !hasBeenVisible) return null

  return (
    <Suspense fallback={null}>
      <ChatAssistantFab {...props} />
    </Suspense>
  )
}
