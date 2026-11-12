/** Reveal received text in short readable groups; never keep a finished reply waiting. */
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getUserPreferences,
  subscribePreferences,
} from '../../lib/userPreferences'
import { MARKDOWN_COMPONENTS } from './markdownComponents'
import {
  CHAT_REVEAL_FRAME_MS as FRAME_MS,
  CHAT_MAX_REVEAL_LAG_MS as MAX_REVEAL_LAG_MS,
  CHAT_REVEAL_CHARACTERS_PER_SECOND,
  readSystemChatReducedMotion,
  subscribeSystemChatReducedMotion,
} from '../../lib/chatPresentation'

const readReducedMotion = () => getUserPreferences().reducedMotion
const serverReducedMotion = () => true
const REMARK_PLUGINS = [remarkGfm]
const BASE_CHARACTERS_PER_FRAME =
  (CHAT_REVEAL_CHARACTERS_PER_SECOND * FRAME_MS) / 1000
const graphemes =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('pl', { granularity: 'grapheme' })
    : null

/** Prefer whole words without waiting for punctuation or splitting an emoji. */
function readableEnd(
  content: string,
  start: number,
  characters: number,
): number {
  let end = Math.min(content.length, start + characters)
  // Prefer an earlier word boundary within this budget. Extending every frame
  // to the next word made the nominal character rate much faster in practice.
  if (end < content.length && !/\s/.test(content.charAt(end))) {
    let wordStart = end
    while (wordStart > start && !/\s/.test(content.charAt(wordStart - 1)))
      wordStart--
    if (wordStart > start) end = wordStart
  }
  if (graphemes) {
    for (const part of graphemes.segment(content)) {
      const boundary = part.index + part.segment.length
      if (boundary >= end) return boundary
    }
  } else if (
    end < content.length &&
    /[\uD800-\uDBFF]/.test(content.charAt(end - 1))
  ) {
    end++
  }
  return end
}
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
  const systemReducedMotion = useSyncExternalStore(
    subscribeSystemChatReducedMotion,
    readSystemChatReducedMotion,
    serverReducedMotion,
  )
  const immediate = reducedMotion || systemReducedMotion || !isStreaming
  const initialContent = isStreaming ? '' : content
  const [buffered, setBuffered] = useState(initialContent)
  const latest = useRef(content)
  const revealed = useRef(initialContent)
  const pendingSince = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latest.current = content
    if (immediate || !content.startsWith(revealed.current)) {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      pendingSince.current = null
      revealed.current = content
      setBuffered(content)
      return
    }
    if (timer.current !== null || revealed.current.length >= content.length)
      return

    const reveal = () => {
      timer.current = null
      const target = latest.current
      const current = revealed.current.length
      if (current >= target.length) {
        pendingSince.current = null
        return
      }
      const now = performance.now()
      pendingSince.current ??= now
      const remaining = MAX_REVEAL_LAG_MS - (now - pendingSince.current)
      const backlog = target.length - current
      // Larger bursts gently catch up within the bounded reading window;
      // ordinary small chunks use the slower, steady reading rhythm.
      const characters =
        remaining <= FRAME_MS
          ? backlog
          : Math.max(
              BASE_CHARACTERS_PER_FRAME,
              Math.ceil((backlog * FRAME_MS) / remaining),
            )
      const end = readableEnd(target, current, characters)
      revealed.current = target.slice(0, end)
      setBuffered(revealed.current)
      if (end < target.length) {
        timer.current = setTimeout(reveal, FRAME_MS)
      } else {
        pendingSince.current = null
      }
    }
    timer.current = setTimeout(reveal, FRAME_MS)
  }, [content, immediate])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      pendingSince.current = null
    },
    [],
  )

  return (
    <div
      className="chat-stream leading-relaxed"
      aria-busy={isStreaming}
      data-revealing={(!immediate && buffered !== content) || undefined}
    >
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
