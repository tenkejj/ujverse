/**
 * Retired index mirror. Keep webhook authentication and acknowledge existing
 * database hooks without exporting public or private rows to an external index.
 * Source search reads Supabase directly with caller RLS.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }
  const secret = Deno.env.get('SYNC_WEBHOOK_SECRET')?.trim()
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  let value: unknown
  try {
    value = await req.json()
  } catch {
    return new Response('Invalid payload', { status: 400 })
  }
  if (!value || typeof value !== 'object')
    return new Response('Invalid payload', { status: 400 })
  const payload = value as { type?: string; table?: string; schema?: string }
  const types = ['INSERT', 'UPDATE', 'DELETE']
  const tables = [
    'posts',
    'announcements',
    'profiles',
    'cohort_messages',
    'cohort_message_attachments',
  ]
  if (
    !types.includes(payload.type ?? '') ||
    !tables.includes(payload.table ?? '') ||
    (payload.schema && payload.schema !== 'public')
  ) {
    return new Response('Invalid payload', { status: 400 })
  }
  return Response.json(
    {
      ok: true,
      action: 'skipped',
      searchBackend: 'supabase',
      reason: 'legacy_indexing_retired',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
})
