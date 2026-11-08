/** Render received text in small batches, with no simulated typing backlog. */
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getUserPreferences,
  subscribePreferences,
} from '../../lib/userPreferences'
import { MARKDOWN_COMPONENTS } from './markdownComponents'

const readReducedMotion = () => getUserPreferences().reducedMotion
const serverReducedMotion = () => true
const REMARK_PLUGINS = [remarkGfm]
const MarkdownContent = memo(function MarkdownContent({
  content,
}: {
  content: string
}) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {content}
    </ReactMarkdown>
  )
})

export default function TypewriterMarkdown({
  content,
  isStreaming,
}: {
  content: string
  isStreaming: boolean
}) {
  const reducedMotion = useSyncExternalStore(
    subscribePreferences,
    readReducedMotion,
    serverReducedMotion,
  )
  const systemReducedMotion = useReducedMotion()
  const immediate = reducedMotion || systemReducedMotion || !isStreaming
  const [buffered, setBuffered] = useState(content)
  const latest = useRef(content)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latest.current = content
    if (immediate) {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      setBuffered(content)
    } else if (timer.current === null) {
      // At most 25 Markdown parses/s. Never delay by character or punctuation.
      timer.current = setTimeout(() => {
        timer.current = null
        setBuffered(latest.current)
      }, 40)
    }
  }, [content, immediate])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    },
    [],
  )

  return (
    <div className="chat-stream leading-relaxed" aria-busy={isStreaming}>
      <MarkdownContent content={immediate ? content : buffered} />
      {isStreaming && (
        <span className="chat-stream-status text-fg-secondary" role="status">
          <span className="chat-stream-dot" aria-hidden />
          Versuś odpowiada…
        </span>
      )}
    </div>
  )
}
