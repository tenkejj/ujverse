/** Received text is paced once at ingress. Only the unfinished Markdown block reparses. */
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MARKDOWN_COMPONENTS } from './markdownComponents'
import { markdownBlocks, streamingMarkdownTail } from '../../lib/chatStream'

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
  const blocks = markdownBlocks(content)
  let offset = 0
  return (
    <div className="chat-stream leading-relaxed" aria-busy={isStreaming}>
      {blocks.map((block) => {
        const start = offset
        offset += block.length
        const active = isStreaming && offset === content.length
        return (
          <MarkdownContent
            key={start}
            content={active ? streamingMarkdownTail(block) : block}
          />
        )
      })}
      <div className="chat-stream-footer">
        {isStreaming ? (
          <span className="chat-stream-status text-fg-secondary" role="status">
            <span className="chat-stream-dot" aria-hidden />Versuś odpowiada…
          </span>
        ) : null}
      </div>
    </div>
  )
}
