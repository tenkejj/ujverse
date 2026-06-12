/**
 * UJverse — VoiceRecorderInline: live UI nagrywania głosówki w composerze Auli.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Renderowany INLINE nad textareą (nie modal — chcemy zachować kontekst sali
 * + szybki gesture anuluj/wyślij). Layout: pulsujące czerwone kółko +
 * timer "0:05 / 5:00" + live volume bars + dwa przyciski: anuluj (X) i
 * wyślij (Send).
 *
 * NIE trzyma własnego state recordera — przyjmuje wszystko z hookowego
 * `useVoiceRecorder` (single source of truth). Auto-stop przy `seconds >=
 * MAX_VOICE_DURATION_S` woła `onStop` (caller decyduje czy wysłać, ale w
 * praktyce overlay sam waliduje cap → przekazuje blob lub cancel jeśli za krótkie).
 *
 * UX guardy:
 *   - Min duration 1s (poniżej = anuluj zamiast wysłać — zabezpieczenie
 *     przed przypadkowymi micro-tap).
 *   - Cap MAX_VOICE_DURATION_S — gdy osiągnięty, hook stopuje auto, my
 *     emitujemy ten sam blob ale w UI pokazujemy "Limit osiągnięty".
 */
import { useEffect } from 'react'
import { Mic, Send, X } from 'lucide-react'
import { formatDuration, MAX_VOICE_DURATION_S } from '../../lib/aulaUpload'
import type { RecordedVoice, VoiceRecorderStatus } from '../../hooks/useVoiceRecorder'

type Props = {
  status: VoiceRecorderStatus
  errorMsg: string | null
  seconds: number
  volume: number
  /** Zatrzymaj recording i ZWRÓĆ blob — caller wyśle dalej. */
  onStop: () => Promise<RecordedVoice | null>
  /** Anuluj — zrzuć buffer, nie wysyłaj. */
  onCancel: () => void
  /** Wywoływane gdy user kliknął Wyślij, ale duration < 1s. UI pokazuje toast. */
  onTooShort?: () => void
  /** Gdy zwrócony blob jest gotowy do uploadu — caller obsługuje upload + send. */
  onConfirm: (recording: RecordedVoice) => void
}

const MIN_DURATION_S = 1

/** Liczba pasków waveform — równa ilości słupków. */
const BARS = 22

/**
 * Pseudo-deterministyczne pseudo-wave: każdy słupek dostaje swoją fazę
 * (`i / BARS * 2π`), wysokość = volume * (0.5 + 0.5 * |sin(phase + t)|).
 * `t` to seconds (re-renderuje co tick); volume jest gain'em całości. Nie
 * jest fizycznie poprawne, ale wystarcza wzrokowo (ruchome słupki podczas mowy).
 */
function VoiceBars({ volume, seconds }: { volume: number; seconds: number }) {
  const t = seconds * 4 // przyspieszamy żeby ruch był widoczny przy 250ms tick
  const bars: JSX.Element[] = []
  for (let i = 0; i < BARS; i += 1) {
    const phase = (i / BARS) * Math.PI * 2
    const wave = 0.5 + 0.5 * Math.abs(Math.sin(phase + t))
    const heightPct = Math.max(10, Math.round((0.15 + volume * 0.85) * wave * 100))
    bars.push(
      <span
        key={i}
        aria-hidden
        className="block w-[3px] rounded-full bg-rose-500 transition-[height] duration-150 dark:bg-rose-400"
        style={{ height: `${heightPct}%` }}
      />,
    )
  }
  return (
    <div className="flex h-7 flex-1 items-center justify-center gap-[3px] overflow-hidden px-2">
      {bars}
    </div>
  )
}

export default function VoiceRecorderInline({
  status,
  errorMsg,
  seconds,
  volume,
  onStop,
  onCancel,
  onTooShort,
  onConfirm,
}: Props) {
  // Auto-stop po przekroczeniu capa — zatrzymujemy i auto-confirm (cap zwraca
  // pełny blob, więc user dostaje swoje nagranie do limitu).
  useEffect(() => {
    if (status === 'recording' && seconds >= MAX_VOICE_DURATION_S) {
      void (async () => {
        const rec = await onStop()
        if (rec) onConfirm(rec)
      })()
    }
  }, [seconds, status, onStop, onConfirm])

  const isRecording = status === 'recording'
  const atCap = seconds >= MAX_VOICE_DURATION_S
  const tooShort = seconds < MIN_DURATION_S

  const handleSend = async () => {
    if (!isRecording) return
    if (tooShort) {
      onTooShort?.()
      onCancel()
      return
    }
    const rec = await onStop()
    if (rec) onConfirm(rec)
  }

  // Error / denied state — pokazujemy pełnoszerokość info z primary action "OK".
  if (status === 'denied' || status === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50 px-3 py-2 dark:border-rose-400/30 dark:bg-rose-500/10">
        <Mic size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
        <p className="min-w-0 flex-1 truncate text-sm text-rose-700 dark:text-rose-200">
          {errorMsg ?? (status === 'denied' ? 'Mikrofon odrzucony' : 'Nie udało się nagrać')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-500/15"
        >
          OK
        </button>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/80 px-3 py-2 dark:border-rose-400/25 dark:bg-rose-500/[0.08]"
    >
      <button
        type="button"
        onClick={onCancel}
        aria-label="Anuluj nagrywanie"
        title="Anuluj"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[0.06] hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
      >
        <X size={16} />
      </button>

      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.18)] dark:bg-rose-400"
      />

      <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-rose-700 dark:text-rose-200">
        {formatDuration(seconds)}
        <span className="ml-1 text-[10px] font-medium text-rose-500/70 dark:text-rose-300/60">
          / {formatDuration(MAX_VOICE_DURATION_S)}
        </span>
      </span>

      <VoiceBars volume={volume} seconds={seconds} />

      <button
        type="button"
        onClick={handleSend}
        disabled={!isRecording || tooShort}
        aria-label={atCap ? 'Wyślij (limit osiągnięty)' : 'Wyślij głosówkę'}
        title={tooShort ? 'Nagranie za krótkie' : atCap ? 'Limit osiągnięty — wyślij' : 'Wyślij głosówkę'}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
      >
        <Send size={16} strokeWidth={2.25} />
      </button>
    </div>
  )
}
