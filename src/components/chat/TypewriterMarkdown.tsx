/**
 * `TypewriterMarkdown` — renderuje treść asystenta z efektem „pisania
 * literka po literce", spowalniając artyficjalnie szybki stream z Groq-a
 * (~150-300 t/s = wizualnie „bęc całość") do tempa ~125 znaków/s,
 * porównywalnego z naturalnym pisaniem ChatGPT/Claude.
 *
 * Kontrakt:
 * - `content` — pełna treść (rośnie wraz z napływającymi SSE chunkami
 *   ze `useChatSend`).
 * - `isStreaming` — `true` gdy serwer wciąż streamuje TĘ wiadomość.
 *
 * Mechanika:
 * - Local state `shown` (liczba znaków już wyświetlonych).
 * - `useState(() => isStreaming ? 0 : content.length)` — historyczne
 *   wiadomości (mount przy `isStreaming=false`) renderują się od razu
 *   w pełni, bez „flicker" pustego stanu.
 * - Podczas streamingu interval co `TICK_MS` przesuwa `shown` o
 *   `CHARS_PER_TICK`, aż dogoni `content.length` (i czeka na nowy chunk).
 * - Gdy `isStreaming` flip'uje na `false` (serwer skończył) — natychmiast
 *   doskakujemy do końca, żeby user nie czekał na resztę animacji.
 *
 * Performance:
 * - `setShown(prev => ...)` zwraca tę samą wartość gdy nie ma postępu
 *   (React bail-out, brak re-rendera).
 * - ReactMarkdown reparsuje sliced content przy każdym tikku — dla
 *   typowych odpowiedzi (kilka KB) niezauważalne. Dla długich (10+ KB)
 *   można podnieść `CHARS_PER_TICK` lub wprowadzić memo.
 *
 * Cancellation: gdy wiadomość znika ze store (np. `clearHistory`),
 * komponent unmount'uje się i cleanup z `useEffect` zatrzymuje interval.
 */

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MARKDOWN_COMPONENTS } from './markdownComponents'

type Props = {
  content: string
  isStreaming: boolean
}

const CHARS_PER_TICK = 2
const TICK_MS = 16

export default function TypewriterMarkdown({ content, isStreaming }: Props) {
  const [shown, setShown] = useState<number>(() =>
    isStreaming ? 0 : content.length,
  )

  useEffect(() => {
    if (!isStreaming) {
      setShown(content.length)
      return
    }
    const intervalId = window.setInterval(() => {
      setShown((prev) =>
        prev >= content.length
          ? prev
          : Math.min(prev + CHARS_PER_TICK, content.length),
      )
    }, TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [content, isStreaming])

  const visible = content.slice(0, shown)

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {visible}
    </ReactMarkdown>
  )
}
