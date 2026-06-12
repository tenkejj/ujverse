/**
 * UJverse — useVoiceRecorder: warstwa hookowa nad `MediaRecorder` API do
 * nagrywania głosówek w Auli.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Stan:
 *   - 'idle'       — nic nie nagrywa, brak permissions request
 *   - 'requesting' — czekamy na getUserMedia (permission prompt)
 *   - 'recording'  — aktywne nagrywanie, `seconds` tyka co 100ms
 *   - 'denied'     — user odmówił mikrofonu (lub brak HTTPS / SecureContext)
 *   - 'error'      — wewnętrzny błąd MediaRecorder / API niedostępne
 *
 * Output:
 *   - `start()`  — async, requestuje mic + startuje recording
 *   - `stop()`   — async, zatrzymuje + zwraca `{ blob, mimeType, durationSeconds }`
 *                  (null gdy nigdy nie startował / cancel)
 *   - `cancel()` — porzuca buffer + zwalnia mic, NIE zwraca blob
 *   - `seconds`  — current duration, tyka co 100ms podczas recordingu
 *   - `volume`   — RMS amplituda (0–1) z AnalyserNode, dla wizualizacji
 *
 * Format wyjścia: preferujemy `audio/webm;codecs=opus` (Chrome/Firefox),
 * fallback `audio/mp4` (Safari iOS), ostatecznie `audio/ogg` (Firefox old).
 * Bucket allowed_mime_types pokrywa wszystkie trzy + `audio/mpeg`.
 *
 * Auto-stop: hook NIE auto-stopuje na `MAX_VOICE_DURATION_S` — caller
 * (overlay) sprawdza `seconds >= MAX` i woła `stop()` sam. Pozwala UI
 * pokazać countdown bez wyścigu z hookiem.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Preferowany porządek MIME — pierwszy supported zostanie użyty. */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const

export type VoiceRecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'denied'
  | 'error'

export type RecordedVoice = {
  blob: Blob
  /** Czysty MIME type bez `;codecs=...` (taki trafia do storage.contentType). */
  mimeType: string
  /** Zawsze >= 1 (round). */
  durationSeconds: number
}

type Result = {
  status: VoiceRecorderStatus
  errorMsg: string | null
  seconds: number
  volume: number
  start: () => Promise<void>
  stop: () => Promise<RecordedVoice | null>
  cancel: () => void
  /** Convenience: czy aktualnie nagrywa (status === 'recording'). */
  isRecording: boolean
}

/**
 * Zwraca pierwszy MIME wspierany przez bieżący MediaRecorder, lub null gdy
 * żaden nie pasuje (skrajne edge — np. starsze WebView).
 */
function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const m of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return null
}

/** Usuwa `;codecs=...` z MIME — storage.contentType nie lubi parametrów. */
function stripCodecs(mime: string): string {
  const idx = mime.indexOf(';')
  return idx === -1 ? mime : mime.slice(0, idx).trim()
}

export function useVoiceRecorder(): Result {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [volume, setVolume] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const tickerRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopResolverRef = useRef<((v: RecordedVoice | null) => void) | null>(null)

  /** Twardy cleanup — invariant: po nim WSZYSTKO zwolnione. */
  const cleanup = useCallback(() => {
    if (tickerRef.current != null) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current
      audioCtxRef.current = null
      // close() jest async ale nie czekamy — fire & forget żeby cleanup był synchroniczny.
      void ctx.close().catch(() => {})
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
    setVolume(0)
  }, [])

  /** Unmount safeguard. */
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const tickVolume = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const buffer = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buffer)
    let sum = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const v = (buffer[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / buffer.length)
    // Lekki gain żeby cisza dawała ~0 a mowa ~0.3–0.8 (czysto wizualnie).
    setVolume(Math.min(1, rms * 2.5))
    rafRef.current = window.requestAnimationFrame(tickVolume)
  }, [])

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorMsg('Przeglądarka nie wspiera nagrywania.')
      return
    }
    const mime = pickSupportedMime()
    if (!mime) {
      setStatus('error')
      setErrorMsg('Brak wspieranego formatu nagrywania.')
      return
    }

    setErrorMsg(null)
    setStatus('requesting')
    setSeconds(0)
    setVolume(0)
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      const e = err as DOMException
      // Heuristic: NotAllowedError / SecurityError = user denial; reszta = error.
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setStatus('denied')
        setErrorMsg('Dostęp do mikrofonu odrzucony.')
      } else {
        setStatus('error')
        setErrorMsg(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu.')
      }
      return
    }

    streamRef.current = stream

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime })
    } catch (err) {
      cleanup()
      setStatus('error')
      setErrorMsg((err as Error)?.message ?? 'MediaRecorder init failed')
      return
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
    }

    recorder.onstop = () => {
      // Komponowanie blob + obliczenie duration. Promise resolveuje wszystkie
      // czekające `stop()`/`cancel()`. Jeśli `stopResolverRef` null = unmount
      // race — po prostu zwalniamy zasoby.
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      const blob = new Blob(chunksRef.current, { type: mime })
      const result: RecordedVoice = {
        blob,
        mimeType: stripCodecs(mime),
        durationSeconds: elapsed,
      }
      const resolver = stopResolverRef.current
      stopResolverRef.current = null
      cleanup()
      setStatus('idle')
      setSeconds(0)
      resolver?.(result)
    }

    recorder.onerror = (ev) => {
      const errEv = ev as Event & { error?: DOMException }
      cleanup()
      setStatus('error')
      setErrorMsg(errEv.error?.message ?? 'Recorder error')
      const resolver = stopResolverRef.current
      stopResolverRef.current = null
      resolver?.(null)
    }

    // Volume analyser (best-effort; brak = po prostu volume zostaje 0).
    try {
      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser
      rafRef.current = window.requestAnimationFrame(tickVolume)
    } catch {
      // ignoruj — analyser jest cosmetic
    }

    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    recorder.start(250) // emit dataavailable co 250ms
    setStatus('recording')

    tickerRef.current = window.setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000))
    }, 250)
  }, [cleanup, status, tickVolume])

  const stop = useCallback(async (): Promise<RecordedVoice | null> => {
    const rec = recorderRef.current
    if (!rec) return null
    if (rec.state === 'inactive') return null

    return new Promise<RecordedVoice | null>((resolve) => {
      stopResolverRef.current = resolve
      try {
        rec.stop()
      } catch {
        const resolver = stopResolverRef.current
        stopResolverRef.current = null
        cleanup()
        setStatus('idle')
        resolver?.(null)
      }
    })
  }, [cleanup])

  const cancel = useCallback(() => {
    // Cancel = stop bez emit. Czyścimy stop resolver żeby `onstop` nie
    // wystrzelił blob do callera.
    stopResolverRef.current = null
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        // ignore
      }
    }
    cleanup()
    setStatus('idle')
    setSeconds(0)
  }, [cleanup])

  return {
    status,
    errorMsg,
    seconds,
    volume,
    start,
    stop,
    cancel,
    isRecording: status === 'recording',
  }
}
