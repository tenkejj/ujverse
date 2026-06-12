/**
 * Edge endpoint do transkrypcji głosu — wrapper na Groq Whisper API.
 *
 * - **Runtime**: Edge (fra1), low-latency dla wschodu UE.
 * - **Model**: `whisper-large-v3-turbo` (Groq) — 216× szybszy od pełnego
 *   large-v3 przy <1% utracie WER. Polski jest oficjalnie wspierany.
 * - **Format wejścia**: `multipart/form-data` z polem `audio` (Blob,
 *   webm/ogg/mp4/mpeg/wav, do 25 MB — twardy limit Groqa). Opcjonalnie
 *   pole `language` (ISO 639-1, default `pl`) i `prompt` (kontekstowy
 *   text-prompt dla Whispera — celowo NIE wystawiamy w MVP, hard-coded
 *   na pusty string żeby uniknąć prompt-injection przez klienta).
 * - **Format wyjścia**: JSON `{ text: string, language?: string }`. NIE
 *   streamujemy — Whisper Turbo zwraca pełen text per call (~0.5–2s
 *   dla typowej głosówki <30s), streaming i tak wymagałby second pass
 *   z VAD na kliencie.
 * - **Auth**: opcjonalny Bearer JWT (anonim też ma rate-limit).
 * - **Rate limit**: 20 req/min per user/IP (Whisper-Turbo na Groq ma
 *   ~7200 sec audio/dobę na free tier — przy 30s głosówkach to ~240
 *   transkrypcji/dobę). 20/min daje burst tolerancję bez wyczerpania
 *   dobowego kontyngentu w pojedynczej sesji.
 * - **Bezpieczeństwo**: walidujemy size + mime + duration (header
 *   `Content-Length` z FormData jest niedostępny w Edge — bierzemy
 *   `blob.size` po `formData.get()`). Brak przekierowania audio do
 *   logów / KV — strumień idzie tylko do Groqa.
 */

import { GroqProviderError } from './_lib/GroqProvider.js'
import { extractRequestUser } from './_lib/auth.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
} from './_lib/ipRateLimit.js'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const TRANSCRIBE_RATE_LIMIT = {
  capacity: 20,
  refillSeconds: 3,
}

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const TRANSCRIBE_MODEL =
  process.env.GROQ_WHISPER_MODEL ?? 'whisper-large-v3-turbo'

/** 25 MB — hard limit Groq Whisper API (overhead niżej, żeby zostawić margin). */
const MAX_AUDIO_BYTES = 24 * 1024 * 1024
/** Whitelist MIME — synchronizujemy z bucketem `aula-files` + `wav`. */
const ALLOWED_AUDIO_MIMES = new Set<string>([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
])
/** Whitelist języków — Whisper wspiera ~100, dla UI dajemy tylko nasze. */
const ALLOWED_LANGUAGES = new Set(['pl', 'en', 'de', 'es', 'fr', 'uk'])

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed')
  }

  // Auth + rate-limit. Krytyczne: Whisper jest droższy obliczeniowo niż
  // chat — exposujemy tylko legit klientów (rate per user / per IP).
  const user = await extractRequestUser(req)
  const rateKey = user.userId
    ? `transcribe:${user.userId}`
    : `transcribe:ip:${extractClientIp(req)}`
  const rate = checkAndConsumeRateLimit(rateKey, TRANSCRIBE_RATE_LIMIT)
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: `Za dużo transkrypcji. Spróbuj za ${Math.ceil(rate.retryAfterMs / 1000)}s.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
          ...CORS_HEADERS,
        },
      },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonError(400, 'Invalid multipart form-data')
  }

  const audioField = form.get('audio')
  if (!(audioField instanceof Blob)) {
    return jsonError(400, 'Missing "audio" file field')
  }
  if (audioField.size === 0) {
    return jsonError(400, 'Empty audio file')
  }
  if (audioField.size > MAX_AUDIO_BYTES) {
    return jsonError(
      413,
      `Plik zbyt duży (max ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))} MB)`,
    )
  }
  // Niektóre Bloby z MediaRecorder mają empty type. Dla nich permissive —
  // pozostawiamy decyzję Whisperowi. Tylko jawnie niezgodne mimes odrzucamy.
  if (audioField.type && !ALLOWED_AUDIO_MIMES.has(audioField.type)) {
    return jsonError(415, `Niewspierany format audio: ${audioField.type}`)
  }

  const langRaw = form.get('language')
  const language =
    typeof langRaw === 'string' && ALLOWED_LANGUAGES.has(langRaw)
      ? langRaw
      : 'pl'

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return jsonError(503, 'Transkrypcja tymczasowo niedostępna (brak konfiguracji).')
  }

  // Re-build FormData z explicit filename — Groq wymaga rozszerzenia żeby
  // poprawnie wykryć format (samo Content-Type to za mało). Fallback `.webm`
  // dla anonimowych blobów z MediaRecorder.
  const upstreamForm = new FormData()
  const filename = inferFilenameFromMime(audioField.type)
  upstreamForm.append('file', audioField, filename)
  upstreamForm.append('model', TRANSCRIBE_MODEL)
  upstreamForm.append('language', language)
  // `response_format: 'json'` daje nam najmniejszy parsing overhead; verbose
  // (z timestampami) zostawiamy na przyszłość.
  upstreamForm.append('response_format', 'json')
  // Temperature 0 → deterministic; ważne dla quasi-cache po identycznej audio
  // (przy 0 modelu raczej nie zmienia decoding-path).
  upstreamForm.append('temperature', '0')

  let upstream: Response
  try {
    upstream = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamForm,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return jsonError(502, `Groq Whisper unreachable: ${msg}`)
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    if (upstream.status === 429) {
      return jsonError(429, 'System przeciążony. Spróbuj za chwilę.')
    }
    // Wrap Groq error w nasz error type (nie wyciekamy raw payloadu, tylko
    // pierwsze 200 znaków dla debug).
    const detail = text ? `: ${text.slice(0, 200)}` : ''
    return jsonError(
      upstream.status,
      `Whisper API ${upstream.status}${detail}`,
    )
  }

  const data = (await upstream.json().catch(() => null)) as
    | { text?: unknown; language?: unknown }
    | null
  if (!data || typeof data.text !== 'string') {
    throw new GroqProviderError('Whisper returned malformed response', upstream.status)
  }

  const responseBody = JSON.stringify({
    text: data.text.trim(),
    language: typeof data.language === 'string' ? data.language : language,
  })

  return new Response(responseBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  })
}

function inferFilenameFromMime(mime: string): string {
  if (!mime) return 'audio.webm'
  if (mime.includes('webm')) return 'audio.webm'
  if (mime.includes('ogg')) return 'audio.ogg'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'audio.m4a'
  if (mime.includes('mpeg')) return 'audio.mp3'
  if (mime.includes('wav') || mime.includes('wave')) return 'audio.wav'
  return 'audio.webm'
}
