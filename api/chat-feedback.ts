/**
 * Endpoint zapisu oceny (kciuk gora / dol) assistant message w czacie AI.
 *
 * Cel: dataset jakosci -> dashboard regresow, sygnal dla cache, base do
 * przyszlych fine-tune'ow / promptu iteracji.
 *
 * Kontrakt:
 *   POST /api/chat-feedback
 *   Authorization: Bearer <jwt>
 *   Content-Type: application/json
 *   Body: { messageId: string, rating: 'up' | 'down', tool?: string, note?: string }
 *
 * Odpowiedzi:
 *   200 { ok: true } - upsert OK (insert lub update jezeli juz oceniono)
 *   204             - delete OK (gdy `rating: null` - cofniecie oceny)
 *   400             - blad walidacji body
 *   401             - brak JWT (anonim nie moze ocenic)
 *   429             - rate limit (jeden user spam ocenami)
 *   500             - blad DB
 *
 * Bezpieczenstwo:
 *  - Wymagamy JWT (RLS chat_feedback.insert tylko `authenticated`).
 *  - `message_id` traktujemy jako opaque string z RAM-u klienta - nie
 *    weryfikujemy "czy ten message istnial" (czat AI jest efemeryczny).
 *  - Note max 1000 znakow (RLS check constraint zaslania, ale API odrzuca
 *    przed insertem dla lepszego errora).
 *  - Per-user rate limit: ipRateLimit.ts juz istnieje, reusujemy.
 */

import { extractRequestUser } from './_lib/auth.js'
import {
  checkAndConsumeRateLimit,
  extractClientIp,
} from './_lib/ipRateLimit.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { incrCounter } from './_lib/metrics.js'

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

const MAX_NOTE_LEN = 1000
const MAX_MESSAGE_ID_LEN = 128
const MAX_TOOL_LEN = 64

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}

type FeedbackBody = {
  messageId: string
  rating: 'up' | 'down' | null
  tool?: string | null
  note?: string | null
}

function parseBody(value: unknown): FeedbackBody | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const messageId = obj.messageId
  const rating = obj.rating
  if (typeof messageId !== 'string' || messageId.trim().length === 0) {
    return null
  }
  if (messageId.length > MAX_MESSAGE_ID_LEN) return null
  // `rating: null` = cofniecie oceny (DELETE).
  if (rating !== 'up' && rating !== 'down' && rating !== null) {
    return null
  }
  const tool =
    typeof obj.tool === 'string' && obj.tool.length > 0 && obj.tool.length <= MAX_TOOL_LEN
      ? obj.tool
      : null
  const note =
    typeof obj.note === 'string' && obj.note.length > 0
      ? obj.note.slice(0, MAX_NOTE_LEN)
      : null
  return {
    messageId: messageId.trim(),
    rating: rating as 'up' | 'down' | null,
    tool,
    note,
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { error: 'Content-Type must be application/json' })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const body = parseBody(raw)
  if (!body) {
    return jsonResponse(400, {
      error: 'Body must be { messageId: string, rating: "up"|"down"|null, tool?, note? }',
    })
  }

  // Auth: wymagamy JWT - feedback to per-user dataset, anonimow nie liczymy.
  const user = await extractRequestUser(req).catch(() => ({ userId: null }))
  if (!user.userId) {
    return jsonResponse(401, { error: 'Auth required for feedback' })
  }

  // Rate limit per user (defense vs spam).
  const rateLimitKey = `feedback:user:${user.userId}`
  const rateLimit = checkAndConsumeRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    return jsonResponse(429, {
      error: `Wolniej — za szybko klikasz. Spróbuj za ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`,
    })
  }

  // Fallback metryka per-IP (gdy uda sie cos w abuse) - nie blokujemy.
  void extractClientIp(req)

  const supabase = getSupabaseAdmin()

  // rating === null -> cofniecie oceny (DELETE wiersza).
  if (body.rating === null) {
    const { error } = await supabase
      .from('chat_feedback')
      .delete()
      .eq('user_id', user.userId)
      .eq('message_id', body.messageId)
    if (error) {
      console.error('[chat-feedback] delete failed:', error.message)
      void incrCounter('chat_feedback:delete_error')
      return jsonResponse(500, { error: 'Database error' })
    }
    void incrCounter('chat_feedback:deleted')
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Upsert na (user_id, message_id) - drugi klik nadpisuje rating/note.
  const { error } = await supabase
    .from('chat_feedback')
    .upsert(
      {
        user_id: user.userId,
        message_id: body.messageId,
        rating: body.rating,
        tool: body.tool,
        note: body.note,
        // updated_at sam idzie z triggera, ale dla explicit upsert dorzucamy.
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,message_id',
        ignoreDuplicates: false,
      },
    )

  if (error) {
    console.error(
      '[chat-feedback] upsert failed for user',
      user.userId,
      '— err:',
      error.message,
    )
    void incrCounter('chat_feedback:upsert_error')
    return jsonResponse(500, { error: 'Database error' })
  }

  void incrCounter(`chat_feedback:${body.rating}`)
  if (body.tool) {
    void incrCounter(`chat_feedback:tool:${body.tool}:${body.rating}`)
  }
  return jsonResponse(200, { ok: true })
}
