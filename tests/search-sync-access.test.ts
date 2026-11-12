import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../api/sync-search.ts'

async function request(
  options: {
    method?: string
    authorized?: boolean
    table?: string
    enabled?: boolean
    index?: string
  } = {},
) {
  const oldSecret = process.env.SECRET_WEBHOOK_KEY
  const oldEnabled = process.env.SEARCH_INDEX_SYNC_ENABLED
  const oldIndex = process.env.MEILI_PUBLIC_INDEX
  const oldFetch = globalThis.fetch
  let calls = 0
  process.env.SECRET_WEBHOOK_KEY = 'synthetic-webhook-secret'
  if (options.enabled) process.env.SEARCH_INDEX_SYNC_ENABLED = '1'
  else delete process.env.SEARCH_INDEX_SYNC_ENABLED
  if (options.index) process.env.MEILI_PUBLIC_INDEX = options.index
  else delete process.env.MEILI_PUBLIC_INDEX
  globalThis.fetch = async () => {
    calls++
    throw new Error('Network is forbidden in access checks')
  }
  const result: {
    status: number
    body: Record<string, unknown> | null
    calls: number
  } = { status: 200, body: null, calls: 0 }
  const response = {
    setHeader() {
      return response
    },
    status(status: number) {
      result.status = status
      return response
    },
    json(body: Record<string, unknown>) {
      result.body = body
      return response
    },
  }
  try {
    await handler(
      {
        method: options.method ?? 'POST',
        headers: {
          authorization:
            options.authorized === false
              ? 'Bearer wrong'
              : 'Bearer synthetic-webhook-secret',
        },
        body: {
          type: 'UPDATE',
          table: options.table ?? 'announcements',
          schema: 'public',
          record: { id: 'synthetic-id' },
        },
      } as unknown as VercelRequest,
      response as unknown as VercelResponse,
    )
    result.calls = calls
    return result
  } finally {
    globalThis.fetch = oldFetch
    if (oldSecret === undefined) delete process.env.SECRET_WEBHOOK_KEY
    else process.env.SECRET_WEBHOOK_KEY = oldSecret
    if (oldEnabled === undefined) delete process.env.SEARCH_INDEX_SYNC_ENABLED
    else process.env.SEARCH_INDEX_SYNC_ENABLED = oldEnabled
    if (oldIndex === undefined) delete process.env.MEILI_PUBLIC_INDEX
    else process.env.MEILI_PUBLIC_INDEX = oldIndex
  }
}

describe('retired index synchronization access', { concurrency: false }, () => {
  it('rejects a forged webhook without reading or writing an index', async () => {
    const result = await request({ authorized: false })
    assert.equal(result.status, 401)
    assert.equal(result.calls, 0)
  })

  it('acknowledges database-primary mode without contacting the missing provider', async () => {
    const result = await request()
    assert.equal(result.status, 200)
    assert.equal(result.body?.reason, 'database_primary')
    assert.equal(result.calls, 0)
  })

  it('never exports private rows even when optional public indexing is enabled', async () => {
    for (const table of [
      'posts',
      'profiles',
      'cohort_messages',
      'cohort_message_attachments',
    ]) {
      const result = await request({ table, enabled: true })
      assert.equal(result.status, 200)
      assert.equal(result.body?.reason, 'private_data_uses_rls')
      assert.equal(result.calls, 0)
    }
  })

  it('rejects reusing any old mixed/private index for the public-only mirror', async () => {
    for (const index of ['ujverse_content', 'ujverse_aula', 'ujverse_users']) {
      const result = await request({ enabled: true, index })
      assert.equal(result.status, 503)
      assert.equal(result.body?.code, 'unsafe_index_configuration')
      assert.equal(result.calls, 0)
    }
  })

  it('allows POST only', async () => {
    const result = await request({ method: 'GET' })
    assert.equal(result.status, 405)
    assert.equal(result.calls, 0)
  })
})
