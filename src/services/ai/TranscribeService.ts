/**
 * UJverse — TranscribeService: klient `/api/transcribe` (Groq Whisper).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Kontrakt: blob audio → text. Bez streamingu — Whisper Turbo zwraca
 * pełen tekst w jednym round-tripie (~0.5–2s dla głosówek <30s).
 *
 * Domyślny język: `pl`. Pozostałe (`en|de|es|fr|uk`) wspierane przez serwer.
 * `AbortSignal` przekazywany do `fetch` — caller (ChatVoiceButton) może
 * uciąć żądanie jeśli user kliknie X w trakcie uploadu.
 */
import { supabase } from '../../supabaseClient'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const ENDPOINT = `${API_BASE}/api/transcribe`

export type TranscribeLanguage = 'pl' | 'en' | 'de' | 'es' | 'fr' | 'uk'

export class TranscribeServiceError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'TranscribeServiceError'
    this.status = status
  }
}

export type TranscribeResult = {
  text: string
  language: string
}

export type TranscribeOptions = {
  language?: TranscribeLanguage
  signal?: AbortSignal
  /**
   * Custom filename — domyślnie wnioskujemy z `blob.type`. Przekaż gdy
   * masz „prawdziwą" nazwę pliku (z `<input type=file>`), żeby Whisper
   * zobaczył poprawne rozszerzenie.
   */
  filename?: string
}

export async function transcribeAudio(
  blob: Blob,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const headers: Record<string, string> = {}
  try {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  } catch {
    // brak auth = anon rate-limit, OK
  }

  const form = new FormData()
  form.append('audio', blob, opts.filename ?? inferFilename(blob.type))
  if (opts.language) form.append('language', opts.language)

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: form,
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TranscribeServiceError('Anulowano', null)
    }
    const msg = err instanceof Error ? err.message : 'Network error'
    throw new TranscribeServiceError(msg, null)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMsg = `Transkrypcja: ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error && typeof parsed.error === 'string') {
        errorMsg = parsed.error
      }
    } catch {
      if (text) errorMsg = text.slice(0, 200)
    }
    throw new TranscribeServiceError(errorMsg, res.status)
  }

  const data = (await res.json().catch(() => null)) as
    | { text?: string; language?: string }
    | null
  if (!data || typeof data.text !== 'string') {
    throw new TranscribeServiceError('Nieprawidłowa odpowiedź transkrypcji', res.status)
  }

  return {
    text: data.text,
    language: typeof data.language === 'string' ? data.language : opts.language ?? 'pl',
  }
}

function inferFilename(mime: string): string {
  if (!mime) return 'audio.webm'
  if (mime.includes('webm')) return 'audio.webm'
  if (mime.includes('ogg')) return 'audio.ogg'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'audio.m4a'
  if (mime.includes('mpeg')) return 'audio.mp3'
  if (mime.includes('wav')) return 'audio.wav'
  return 'audio.webm'
}
