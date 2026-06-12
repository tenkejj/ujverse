/**
 * UJverse — ChatVoiceButton: mic dla composer asystenta AI.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Trzy stany wizualne, jeden komponent:
 *   1. idle    — okrągły button z `Mic`, klik = start recording
 *   2. recording — pulsująca czerwona ikona + timer + Stop/Cancel
 *   3. transcribing — spinner, nieklikalne
 *
 * Po stop → blob transkrybowany przez `TranscribeService` → callback
 * `onTranscript(text)` wstawia rezultat do composera. Caller decyduje
 * czy auto-send czy do edycji (default UX = do edycji; user może doszlifować).
 *
 * Mic guard: gdy `disabled` (np. AI właśnie streamuje), button jest
 * niewidoczny w trybie idle (mniej UI noise) lub wyszarzony w pełnym
 * trybie. `compact` prop dla małej wersji (wyspa `ChatAssistant`).
 *
 * Inline overlay zamiast osobnego portal-modala — pasuje do composer-row
 * (timer + waveform mieszczą się obok pozostałych kontrolek), unika
 * focus-trap modali.
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Send, X } from 'lucide-react'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import {
  transcribeAudio,
  TranscribeServiceError,
} from '../../services/ai/TranscribeService'
import { toast } from '../../lib/appToast'

const MAX_RECORDING_SECONDS = 60
const MIN_RECORDING_SECONDS = 1

type Props = {
  onTranscript: (text: string) => void
  disabled?: boolean
  /** `compact` = mała wersja dla wyspy (h-9 w-9), `regular` = duża dla hub (h-12 w-12). */
  size?: 'compact' | 'regular'
  /** Customizable label dla aria. */
  ariaLabel?: string
}

export default function ChatVoiceButton({
  onTranscript,
  disabled = false,
  size = 'regular',
  ariaLabel = 'Nagraj wiadomość głosową',
}: Props) {
  const {
    status,
    errorMsg,
    seconds,
    volume,
    start,
    stop,
    cancel,
    isRecording,
  } = useVoiceRecorder()
  const [transcribing, setTranscribing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-stop przy MAX. Cancel + przepuść blob → onTranscript path.
  useEffect(() => {
    if (isRecording && seconds >= MAX_RECORDING_SECONDS) {
      void handleStop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, seconds])

  // Cleanup abort przy unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const sizeClasses =
    size === 'compact'
      ? 'h-9 w-9'
      : 'h-12 w-12'
  const iconSize = size === 'compact' ? 14 : 18

  const handleStart = async () => {
    if (disabled || transcribing) return
    await start()
  }

  const handleCancel = () => {
    cancel()
  }

  const handleStop = async () => {
    if (seconds < MIN_RECORDING_SECONDS) {
      // Za krótko żeby cokolwiek miało sens → cichy cancel + hint
      cancel()
      toast('Nagranie za krótkie — przytrzymaj dłużej.')
      return
    }
    const recorded = await stop()
    if (!recorded) return

    setTranscribing(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await transcribeAudio(recorded.blob, {
        language: 'pl',
        signal: controller.signal,
      })
      const text = result.text.trim()
      if (!text) {
        toast('Nie wykryto wypowiedzi.')
        return
      }
      onTranscript(text)
    } catch (err) {
      if (err instanceof TranscribeServiceError && err.message === 'Anulowano') {
        // user anulował przy unmount — silent
        return
      }
      const msg =
        err instanceof Error ? err.message : 'Transkrypcja nie powiodła się.'
      toast.error(msg)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setTranscribing(false)
    }
  }

  // Recording UI — inline replacement dla samego mic buttona.
  if (isRecording || status === 'requesting') {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-rose-700 shadow-inner dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200 ${size === 'regular' ? 'h-12' : 'h-9'}`}
      >
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Anuluj nagrywanie"
          title="Anuluj"
          className="inline-flex shrink-0 items-center justify-center rounded-full text-rose-500 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-100"
        >
          <X size={iconSize} />
        </button>

        <div className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => {
            const baseHeight = 4 + Math.round(volume * 14)
            const phaseShift = (i - 2) * 1.4
            const h = Math.max(3, Math.min(18, baseHeight - Math.abs(phaseShift)))
            return (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className="w-0.5 rounded-full bg-rose-500 transition-[height] duration-100 dark:bg-rose-300"
              />
            )
          })}
        </div>

        <span className="font-mono text-xs tabular-nums">
          {formatTime(seconds)} / {formatTime(MAX_RECORDING_SECONDS)}
        </span>

        <button
          type="button"
          onClick={handleStop}
          aria-label="Zakończ i prześlij"
          title="Zakończ i prześlij"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <Send size={iconSize - 2} />
        </button>
      </div>
    )
  }

  if (transcribing) {
    return (
      <button
        type="button"
        disabled
        aria-label="Transkrybuję…"
        className={`${sizeClasses} inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400`}
      >
        <Loader2 size={iconSize} className="animate-spin" />
      </button>
    )
  }

  const denied = status === 'denied'
  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={disabled || denied}
      aria-label={denied ? 'Brak dostępu do mikrofonu' : ariaLabel}
      title={
        denied
          ? errorMsg ?? 'Brak dostępu do mikrofonu. Zezwól w ustawieniach przeglądarki.'
          : 'Nagraj wiadomość głosową'
      }
      className={[
        sizeClasses,
        'inline-flex shrink-0 items-center justify-center rounded-full border transition-colors',
        denied
          ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-600'
          : 'border-zinc-200 bg-white/70 text-zinc-600 hover:border-logo-navy/30 hover:bg-zinc-50 hover:text-logo-navy disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-300 dark:hover:border-brand-gold-bright/30 dark:hover:bg-zinc-900/70 dark:hover:text-brand-gold-bright',
      ].join(' ')}
    >
      {denied ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
    </button>
  )
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
