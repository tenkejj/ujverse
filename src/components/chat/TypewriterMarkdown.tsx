/**
 * `TypewriterMarkdown` — renderuje treść asystenta z efektem „pisania
 * literka po literce", spowalniając artyficjalnie szybki stream z Groq-a
 * (~150-300 t/s = wizualnie „bęc całość") do tempa szybszego niż
 * ChatGPT/Claude, ale wciąż dającego rytm „pisania" (~200 cps bazowo,
 * z adaptacyjnym catch-up gdy bufor SSE puchnie).
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
 * - **Ref-y** dla `content` i `isStreaming` — `setInterval` czyta zawsze
 *   najnowsze wartości, dzięki czemu szybkie chunki SSE (5-10 ms apart)
 *   NIE resetują timera. To było źródło bugu #1: poprzednia wersja miała
 *   `[content]` w deps useEffect-u, więc cleanup `clearInterval` odpalał
 *   się przed pierwszym tickiem timera (16 ms) i animacja nigdy nie
 *   ruszała.
 * - Po flipie `isStreaming` na `false` typewriter NIE doskakuje do końca,
 *   tylko spokojnie animuje pozostałe znaki aż `shown` dogoni `content.length`.
 *   To bug #2: poprzednio krótkie odpowiedzi z Groq (sub-sekundowe) ledwo
 *   zdążyły zacząć animację, zanim instant-jump nadpisał `shown`.
 * - Adaptacyjne tempo: gdy bufor (target - prev) puchnie powyżej progu,
 *   skalujemy `step` proporcjonalnie do zaległości — krótkie odpowiedzi
 *   lecą w bazowym tempie, długie nie zostają o całe akapity w tyle.
 *
 * Performance:
 * - `setShown(prev => ...)` zwraca tę samą wartość gdy nie ma postępu
 *   (React bail-out, brak re-rendera).
 * - Po dogonieniu `content.length` przy `!isStreaming` callback `clearInterval`-uje
 *   sam siebie (oszczędność CPU dla długich rozmów / wielu starych bąbelków).
 * - ReactMarkdown reparsuje sliced content przy każdym tikku — dla
 *   typowych odpowiedzi (kilka KB) niezauważalne. Dla długich (10+ KB)
 *   można podnieść `BASE_CHARS_PER_TICK` lub wprowadzić memo.
 *
 * Cancellation: gdy wiadomość znika ze store (np. `clearHistory`),
 * komponent unmount'uje się i cleanup z `useEffect` zatrzymuje interval.
 */

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MARKDOWN_COMPONENTS } from './markdownComponents'

type Props = {
  content: string
  isStreaming: boolean
}

const BASE_CHARS_PER_TICK = 2
const TICK_MS = 10
const CATCHUP_BACKLOG_THRESHOLD = 80
const CATCHUP_DIVISOR = 24

export default function TypewriterMarkdown({ content, isStreaming }: Props) {
  const [shown, setShown] = useState<number>(() =>
    isStreaming ? 0 : content.length,
  )

  const contentRef = useRef(content)
  contentRef.current = content
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  useEffect(() => {
    if (!isStreaming && shown >= content.length) return

    const id = window.setInterval(() => {
      setShown((prev) => {
        const target = contentRef.current.length
        if (prev >= target) {
          if (!isStreamingRef.current) {
            window.clearInterval(id)
          }
          return prev
        }
        const backlog = target - prev
        const step =
          backlog > CATCHUP_BACKLOG_THRESHOLD
            ? Math.max(BASE_CHARS_PER_TICK, Math.ceil(backlog / CATCHUP_DIVISOR))
            : BASE_CHARS_PER_TICK
        return Math.min(prev + step, target)
      })
    }, TICK_MS)

    return () => window.clearInterval(id)
    // Refs przenoszą najnowsze `content`/`shown` do callbacka, więc deps
    // celowo zawężone do `isStreaming` — nie chcemy restartu timera przy
    // każdym chunk-u SSE (to był bug #1).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  const visible = content.slice(0, shown)

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {visible}
    </ReactMarkdown>
  )
}
