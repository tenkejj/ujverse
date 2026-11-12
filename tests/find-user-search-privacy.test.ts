import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { executeFindUserSearch } from '../api/_lib/tools/findUser.ts'
import { getToolEntry, registerTool } from '../api/_lib/tools/registry.ts'

type Call = { method: string; args: unknown[] }
function databaseMock(rows: unknown[] = []) {
  const calls: Call[] = []
  const client = { from(table: string) {
    calls.push({ method: 'from', args: [table] })
    const query = new Proxy({}, { get(_target, method) {
      if (method === 'then') return (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve)
      return (...args: unknown[]) => { calls.push({ method: String(method), args }); return query }
    } })
    return query
  } } as unknown as SupabaseClient
  return { client, calls }
}

const profile = {
  id: 'profile-a', full_name: 'Anna Studentka', username: 'anna',
  study_program: null, year_started: null, department: 'Poufny wydział',
  is_searchable: true, is_banned: false, show_department: false,
}

describe('find_user chat tool privacy', () => {
  it('bypasses cache for explicit zero and keeps the default cache path', async (test) => {
    const previousUrl = process.env.KV_REST_API_URL
    const previousToken = process.env.KV_REST_API_TOKEN
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    let fetches = 0
    const cacheLogs: unknown[][] = []
    test.mock.method(console, 'log', (...args: unknown[]) => { cacheLogs.push(args) })
    test.mock.method(console, 'warn', (...args: unknown[]) => { cacheLogs.push(args) })
    test.mock.method(globalThis, 'fetch', async () => {
      fetches++
      return new Response(JSON.stringify([{ result: '"stale cached result"' }]))
    })
    let executions = 0
    registerTool({
      tool: { name: 'explicit_zero_cache_probe', description: 'Synthetic cache regression probe', parameters: { type: 'object', properties: {} } },
      execute: async () => ++executions,
      ttlMs: 0,
    })
    try {
      const { client } = databaseMock()
      const entry = getToolEntry('explicit_zero_cache_probe')!
      const context = { userId: 'synthetic-viewer', supabaseAdmin: client }
      assert.deepEqual([await entry.execute({}, context), await entry.execute({}, context)], [1, 2])
      assert.equal(fetches, 0)
      assert.deepEqual(cacheLogs, [])
      registerTool({
        tool: { name: 'default_cache_probe', description: 'Synthetic default-cache regression probe', parameters: { type: 'object', properties: {} } },
        execute: async () => 42,
      })
      assert.equal(await getToolEntry('default_cache_probe')!.execute({}, context), 42)
      assert.ok(cacheLogs.some(args => String(args[0]).includes('[Tool Cache]')))
    } finally {
      if (previousUrl === undefined) delete process.env.KV_REST_API_URL
      else process.env.KV_REST_API_URL = previousUrl
      if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN
      else process.env.KV_REST_API_TOKEN = previousToken
    }
  })

  it('denies an anonymous executor call before administrative data access', async () => {
    const { client, calls } = databaseMock([profile])
    const result = await executeFindUserSearch({ query: 'Anna' }, { userId: null, supabaseAdmin: client })
    assert.match(result, /zalogowania/)
    assert.deepEqual(calls, [])
  })

  it('filters discoverability and bans before the scan limit and defensively in output', async () => {
    const { client, calls } = databaseMock([
      profile,
      { ...profile, id: 'hidden', full_name: 'Ukryta Studentka', is_searchable: false },
      { ...profile, id: 'banned', full_name: 'Zbanowana Studentka', is_banned: true },
      { ...profile, id: 'unknown', full_name: 'Nieznany wybór', is_searchable: null },
      { ...profile, id: 'viewer', full_name: 'Bieżący użytkownik' },
    ])
    const result = await executeFindUserSearch({ query: 'Anna' }, { userId: 'viewer', supabaseAdmin: client })
    assert.ok(result.includes('[Anna Studentka](/u/anna)'))
    for (const hidden of ['Poufny wydział', 'Ukryta Studentka', 'Zbanowana Studentka', 'Nieznany wybór', 'Bieżący użytkownik']) {
      assert.equal(result.includes(hidden), false)
    }
    const limitIndex = calls.findIndex(call => call.method === 'limit')
    assert.ok(limitIndex > calls.findIndex(call => call.method === 'eq' && call.args[0] === 'is_searchable' && call.args[1] === true))
    assert.ok(limitIndex > calls.findIndex(call => call.method === 'not' && call.args[0] === 'is_banned' && call.args[1] === 'is' && call.args[2] === true))
    assert.deepEqual(calls[limitIndex]?.args, [30])
    assert.ok(calls.some(call => call.method === 'select' && String(call.args[0]).includes('show_department')))
  })

  it('shows department metadata only with explicit permission', async () => {
    const visible = databaseMock([{ ...profile, show_department: true }])
    const visibleResult = await executeFindUserSearch({ query: 'Anna' }, { userId: 'viewer', supabaseAdmin: visible.client })
    assert.ok(visibleResult.includes('Poufny wydział'))
    const missing = databaseMock([{ ...profile, show_department: null }])
    const missingResult = await executeFindUserSearch({ query: 'Anna' }, { userId: 'viewer', supabaseAdmin: missing.client })
    assert.equal(missingResult.includes('Poufny wydział'), false)
  })

  it('rejects wildcard-only queries and escapes literal SQL wildcards', async () => {
    const invalid = databaseMock()
    await executeFindUserSearch({ query: '"()*' }, { userId: 'viewer', supabaseAdmin: invalid.client })
    assert.deepEqual(invalid.calls, [])
    const escaped = databaseMock()
    await executeFindUserSearch({ query: '100%_done' }, { userId: 'viewer', supabaseAdmin: escaped.client })
    assert.ok(escaped.calls.some(call => call.method === 'or' && call.args[0] === 'full_name.ilike.%100\\%\\_done%,username.ilike.%100\\%\\_done%,study_program.ilike.%100\\%\\_done%'))
  })
})
