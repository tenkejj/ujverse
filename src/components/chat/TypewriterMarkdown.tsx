/**
 * `TypewriterMarkdown` — renderuje treść asystenta z efektem „pisania
 * literka po literce" w naturalnym, „designerskim" tempie. Cel: nie
 * wypluwać odpowiedzi instant, dać użytkownikowi poczucie że asystent
 * faktycznie myśli i pisze.
 *
 * Tempo bazowe: ~50-60 cps (chars-per-second). To wolniej niż ChatGPT
 * (~100 cps), ale czyta się jak człowiek piszący szybko, nie jak terminal.
 *
 * Naturalne pauzy:
 *  - po `.`, `!`, `?` — krótka pauza (oddech zdaniowy).
 *  - po `,`, `;`, `:` — bardzo krótka pauza (rytm).
 *  - po `\n` — pauza średnia (przejście linii).
 * Te pauzy to NIE „delay między tikkami", tylko zliczane w *budżet znaków*
 * — gdy znak jest interpunkcją, kolejny tik typewriter'a robi pauzę
 *  (ale wciąż w stałym 16ms loopie, więc ekran nigdy nie zatrzymuje się
 *  na > 1 frame, co dałoby wrażenie zacięcia).
 *
 * Kursor:
 *  - ▍ block-cursor migający w cyklu 800ms.
 *  - Renderowany TYLKO podczas streamingu — gdy dogonimy `content.length`
 *    i isStreaming==false, znika.
 *  - Kursor jest osobnym `<span>` po `<ReactMarkdown>` (markdown sam się
 *    nie psuje, bo go nie konsumuje).
 *
 * Fade-in dla nowych linii:
 *  - Przy każdym nowym `\n` w `visible` doczepiamy CSS class do tego
 *    paragrafu (animacja `chat-line-fade-in`). Definicja w `index.css`.
 *  - Implementacja: opakowujemy ReactMarkdown w wrapper z `key={shown}` —
 *    NIE, to zabiłoby memoizację. Zamiast tego: dodajemy class do
 *    rootowego `<div>` i polegamy na CSS animation re-trigger via
 *    `animation-fill-mode: backwards` + custom `--char-count` var.
 *  - Najprościej: każdy `<p>` z `markdownComponents.tsx` ma już
 *    `chat-line-fade-in` class — dodam tam.
 *
 * Performance:
 *  - `setShown(prev => ...)` zwraca tę samą wartość gdy nie ma postępu
 *    (React bail-out, brak re-rendera).
 *  - Po dogonieniu `content.length` przy `!isStreaming` callback
 *    `clearInterval`-uje sam siebie (oszczędność CPU).
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

/**
 * Bazowe tempo: 1 znak co 18ms = ~55 cps. Wolniej niż 100 cps (ChatGPT),
 * ale szybciej niż 30 cps (sztuczne, irytujące). Sweet spot dla rytmu
 * „piszącego asystenta".
 */
const BASE_TICK_MS = 14

/**
 * Pauzy „naturalnego oddechu" — wartości w ms, czyli ile dodatkowo
 * trzymamy się na danym znaku przed kolejnym tikiem. Nie używamy
 * `setTimeout` per-pause (drogie), tylko zliczamy „debt" w refie i
 * następne tiki czekają aż dług się odsączy.
 *
 * Wartości dobrane tak, żeby pauzy były ZAUWAŻALNE ale niezbyt
 * irytujące. Kropka 240ms ≈ ⅙ sekundy — wystarczy na „mentalny oddech".
 */
const PAUSE_MS_AT: Record<string, number> = {
  '.': 240,
  '!': 240,
  '?': 240,
  ',': 70,
  ';': 100,
  ':': 100,
  '\n': 150,
}

/**
 * Maks „buforowy" backlog (znaki) zanim zaczniemy „doganiać" — chronimy się
 * przed sytuacją, gdy serwer wypluje 5KB tekstu w jednym chunku i animacja
 * zostaje 30 sekund w tyle. Powyżej tego progu typujemy 2 zn/tik (a gdy
 * jeszcze większy — 3 zn/tik).
 */
const CATCHUP_BACKLOG_THRESHOLD = 180
const CATCHUP_HEAVY_THRESHOLD = 600

export default function TypewriterMarkdown({ content, isStreaming }: Props) {
  const [shown, setShown] = useState<number>(() =>
    isStreaming ? 0 : content.length,
  )

  // Refs przenoszą najnowsze wartości do callbacka setInterval — bez
  // restartowania timera przy każdym chunk-u SSE.
  const contentRef = useRef(content)
  contentRef.current = content
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming

  // „Dług czasu" w ms — ile jeszcze musimy odczekać zanim wypiszemy
  // kolejny znak. Działa jak budżet: każdy tick odejmuje BASE_TICK_MS,
  // a gdy spadnie do 0, wypisujemy znak i potencjalnie dokładamy pauzę.
  const debtMsRef = useRef(0)

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

        // Catch-up: gdy bufor strasznie urośnie, idziemy 2-3 zn/tik
        // (wciąż wolniej niż instant, ale nie zostajemy w tyle o 5 KB).
        const backlog = target - prev
        const charsThisTick =
          backlog > CATCHUP_HEAVY_THRESHOLD
            ? 3
            : backlog > CATCHUP_BACKLOG_THRESHOLD
              ? 2
              : 1

        // Odsączanie długu z poprzedniej pauzy.
        debtMsRef.current = Math.max(0, debtMsRef.current - BASE_TICK_MS)
        if (debtMsRef.current > 0) {
          // Wciąż w pauzie — nic nie wypisujemy w tym ticku.
          return prev
        }

        // Wypisz `charsThisTick` znaków i dolicz pauzę za ostatni.
        const next = Math.min(prev + charsThisTick, target)
        const lastChar = contentRef.current.charAt(next - 1)
        const pause = PAUSE_MS_AT[lastChar]
        if (pause && backlog < CATCHUP_BACKLOG_THRESHOLD) {
          // Pauzę „dziedziczymy" tylko gdy NIE jesteśmy w trybie catch-up
          // (długie buforowane responses ignorują rytm interpunkcji).
          debtMsRef.current = pause
        }

        return next
      })
    }, BASE_TICK_MS)

    return () => window.clearInterval(id)
    // Refs przenoszą `content`/`shown` — deps celowo ograniczone do
    // `isStreaming`, żeby nie restartować timera per-chunk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  const visible = content.slice(0, shown)
  const showCursor = isStreaming || shown < content.length

  return (
    <div className="chat-typewriter relative">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {visible}
      </ReactMarkdown>
      {showCursor && (
        <span
          aria-hidden
          className="chat-typewriter-cursor"
        >
          ▍
        </span>
      )}
    </div>
  )
}
