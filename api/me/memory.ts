/**
 * GET/DELETE `/api/me/memory` — podgląd i czyszczenie preferencji Versusia.
 */

import { extractRequestUser } from '../_lib/auth.js'
import { clearUserMemory, getUserMemory } from '../_lib/userMemory.js'

export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const { userId } = await extractRequestUser(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Musisz być zalogowany.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'GET') {
    const facts = await getUserMemory(userId)
    return new Response(JSON.stringify({ facts: facts ?? [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (req.method === 'DELETE') {
    await clearUserMemory(userId)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
