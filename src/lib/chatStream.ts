/** SSE transport framing, independent of HTTP packet / UTF-8 character boundaries. */
export async function* readSSEFrames(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let separator = /\r?\n\r?\n/.exec(buffer)
      while (separator) {
        yield buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator[0].length)
        separator = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) break
    }
    if (buffer.trim()) yield buffer
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export const STREAM_FRAME_MS = 32
export const STREAM_MAX_LAG_MS = 96

type PresenterOptions = {
  publish: (text: string) => void
  immediate: () => boolean
  now?: () => number
  schedule?: (callback: () => void) => ReturnType<typeof setTimeout>
  unschedule?: (timer: ReturnType<typeof setTimeout>) => void
}

/** One bounded presentation queue. Only this layer paces text; Markdown never retypes it. */
export function createStreamPresenter({
  publish, immediate, now = () => performance.now(),
  schedule = (callback) => setTimeout(callback, STREAM_FRAME_MS),
  unschedule = clearTimeout,
}: PresenterOptions) {
  let pending = ''
  let pendingSince = 0
  let first = true
  let drained: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const stopTimer = () => {
    if (timer !== null) unschedule(timer)
    timer = null
  }
  const flush = () => {
    stopTimer()
    if (!pending) return
    const text = pending
    pending = ''
    publish(text)
    drained?.()
    drained = null
  }
  const tick = () => {
    timer = null
    if (!pending) return
    // Large provider bursts catch up within 96ms; sparse deltas never wait for a word.
    if (immediate() || now() - pendingSince >= STREAM_MAX_LAG_MS) return flush()
    let end = Math.min(pending.length, Math.max(8, Math.ceil(pending.length / 2)))
    if (end < pending.length && /[\uD800-\uDBFF]/.test(pending.charAt(end - 1))) end++
    const text = pending.slice(0, end)
    pending = pending.slice(end)
    publish(text)
    if (pending) timer = schedule(tick)
    else { drained?.(); drained = null }
  }
  return {
    push(text: string) {
      if (!text) return
      if (!pending) pendingSince = now()
      pending += text
      if (first && immediate()) { first = false; flush(); return }
      if (first) {
        first = false
        // The first visible text has no scheduled delay, including slow streams.
        let end = Math.min(pending.length, 24)
        if (end < pending.length && /[\uD800-\uDBFF]/.test(pending.charAt(end - 1))) end++
        publish(pending.slice(0, end))
        pending = pending.slice(end)
      }
      if (timer === null) timer = schedule(tick)
    },
    finish(): Promise<void> {
      if (!pending) return Promise.resolve()
      if (immediate()) { flush(); return Promise.resolve() }
      return new Promise((resolve) => {
        drained = resolve
        if (timer === null) timer = schedule(tick)
      })
    },
    flush,
    dispose() { stopTimer(); pending = ''; drained?.(); drained = null },
  }
}

/** Hide an unfinished link destination so its long URL cannot expand then collapse a line. */
export function streamingMarkdownTail(content: string): string {
  const fences = content.match(/^ {0,3}(?:`{3,}|~{3,})/gm)
  if (fences && fences.length % 2 !== 0) return content
  return content.replace(/\[([^\]\n]+)\]\([^\)\n]*$/, (_match, label: string, offset: number) => {
    const line = content.slice(content.lastIndexOf('\n', offset) + 1, offset)
    return (line.match(/`/g)?.length ?? 0) % 2 ? _match : label
  })
}

/** Split only at safe block boundaries; definitions retain whole-document context. */
export function markdownBlocks(content: string): string[] {
  if (
    /^ {0,3}\[[^\]]+\]:/m.test(content) ||
    /\]\[[^\]]*\]/.test(content) ||
    /^ {0,3}<(?:!--|\/?[a-zA-Z][\w-]*(?:\s|>|$))/m.test(content)
  ) return [content]
  const blocks: string[] = []
  const lines = content.split('\n')
  let start = 0
  let offset = 0
  let fence: { marker: string; length: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (match) {
      if (!fence) fence = { marker: match[1][0], length: match[1].length }
      else if (match[1][0] === fence.marker && match[1].length >= fence.length && /^ {0,3}(`+|~+)\s*$/.test(line)) fence = null
    }
    offset += line.length + (i < lines.length - 1 ? 1 : 0)
    const next = lines[i + 1]
    // Keep lists, indented continuations, tables and setext headings together.
    if (!fence && line === '' && next && !/^(?:\s|>|[-+*](?:\s|$)|\d+[.)]\s|\||[-=]+\s*$)/.test(next)) {
      blocks.push(content.slice(start, offset))
      start = offset
    }
  }
  if (start < content.length) blocks.push(content.slice(start))
  return blocks.length ? blocks : ['']
}
