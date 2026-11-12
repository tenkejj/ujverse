import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  searchAnnouncementsFallback,
  searchAulaFallback,
  searchUnifiedFallback,
} from '../src/services/searchFallback.ts'

type QueryCall = { table: string; method: string; args: unknown[] }
type QueryResult = { data?: unknown[] | null; error?: { message: string } | null; count?: number | null }

/** Records requests while deliberately returning unfiltered fixture rows. */
function databaseMock(results: Record<string, QueryResult> = {}) {
  const calls: QueryCall[] = []
  const client = {
    from(table: string) {
      calls.push({ table, method: 'from', args: [] })
      const query = new Proxy({}, {
        get(_target, method) {
          if (method === 'then') {
            return (resolve: (value: QueryResult) => unknown) => {
              calls.push({ table, method: 'execute', args: [] })
              return Promise.resolve({ data: [], error: null, ...results[table] }).then(resolve)
            }
          }
          return (...args: unknown[]) => {
            calls.push({ table, method: String(method), args })
            return query
          }
        },
      })
      return query
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

function hasCall(calls: QueryCall[], table: string, method: string, ...args: unknown[]) {
  return calls.some(call => call.table === table && call.method === method && JSON.stringify(call.args) === JSON.stringify(args))
}

const author = { id: 'author-a', full_name: 'Anna', is_banned: false, department: 'Prywatny wydział', show_department: false }
const message = {
  id: 45, cohort_id: 'cohort-a', user_id: 'author-a', content: 'Notatki do egzaminu',
  created_at: '2026-11-10T10:00:00Z', profiles: author,
  cohort_channels: { id: 9, name: 'Wykład', slug: 'wyklad', kind: 'wyk' },
  cohort_message_attachments: [{ file_name: 'notatki.pdf' }],
}

describe('database search request and privacy contract', () => {
  it('requests searchable, unbanned profiles and independently removes hidden fixture rows', async () => {
    const { client, calls } = databaseMock({ profiles: { data: [
      { ...author, id: 'visible', is_searchable: true },
      { ...author, id: 'hidden', is_searchable: false },
      { ...author, id: 'banned', is_searchable: true, is_banned: true },
    ] } })
    const result = await searchUnifiedFallback(client, 'Anna', {
      includeContent: false, limit: 10000, userDepartmentFilter: 'Wydział',
    }, null, 'Anna')
    assert.deepEqual(result.users.map(user => user.id), ['visible'])
    assert.equal(result.users[0]?.department, null)
    assert.ok(hasCall(calls, 'profiles', 'eq', 'is_searchable', true))
    assert.ok(hasCall(calls, 'profiles', 'not', 'is_banned', 'is', true))
    assert.ok(hasCall(calls, 'profiles', 'eq', 'show_department', true))
    assert.ok(hasCall(calls, 'profiles', 'limit', 50))
    assert.deepEqual(calls.filter(call => call.method === 'from').map(call => call.table), ['profiles'])
  })

  it('removes banned-author posts and hidden department metadata', async () => {
    const { client, calls } = databaseMock({ posts: { data: [
      { id: 1, content: 'Notatki', profiles: author },
      { id: 2, content: 'Notatki', profiles: { ...author, is_banned: true } },
    ] } })
    const result = await searchUnifiedFallback(client, '#notatki', { limit: 4 }, 'notatki', '')
    assert.deepEqual(result.content.map(hit => hit.id), ['post-1'])
    assert.equal(result.content[0]?.department, null)
    assert.deepEqual(result.users, [])
    assert.ok(hasCall(calls, 'posts', 'not', 'profiles.is_banned', 'is', true))
    assert.ok(calls.some(call => call.table === 'posts' && call.method === 'select' && String(call.args[0]).includes('profiles!inner(')))
    assert.deepEqual(calls.filter(call => call.method === 'from').map(call => call.table), ['posts'])
  })

  it('keeps both Aula attachment and message reads scoped and bounded', async () => {
    const { client, calls } = databaseMock({
      cohort_message_attachments: { data: [
        { message_id: 45 }, { message_id: '7),cohort_id.neq.cohort-a' }, { message_id: -1 }, { message_id: 'NaN' },
      ] },
      cohort_messages: { data: [message, { ...message, id: 46, profiles: { ...author, is_banned: true } }], count: 1 },
    })
    const result = await searchAulaFallback(client, 'notatki', {
      cohortId: 'cohort-a', limit: 10000, offset: 1e9, hasAttachments: true,
    })
    assert.deepEqual(result.hits.map(hit => hit.messageId), [45])
    assert.deepEqual(result.hits[0]?.fileNames, ['notatki.pdf'])
    assert.equal(result.hits[0]?.contentSnippetHTML, null)
    assert.ok(hasCall(calls, 'cohort_message_attachments', 'eq', 'cohort_messages.cohort_id', 'cohort-a'))
    assert.ok(hasCall(calls, 'cohort_message_attachments', 'limit', 100))
    assert.ok(hasCall(calls, 'cohort_messages', 'eq', 'cohort_id', 'cohort-a'))
    assert.ok(hasCall(calls, 'cohort_messages', 'is', 'deleted_at', null))
    assert.ok(hasCall(calls, 'cohort_messages', 'not', 'profiles.is_banned', 'is', true))
    assert.ok(hasCall(calls, 'cohort_messages', 'range', 10000, 10049))
    assert.ok(hasCall(calls, 'cohort_messages', 'limit', 20, { referencedTable: 'cohort_message_attachments' }))
    assert.ok(hasCall(calls, 'cohort_messages', 'or', 'content.ilike.%notatki%,id.in.(45)'))
    assert.ok(calls.some(call => call.table === 'cohort_messages' && call.method === 'select' && String(call.args[0]).includes('cohort_message_attachments!inner(file_name)')))
  })

  it('restricts channel-kind discovery to the chosen cohort and valid IDs', async () => {
    const { client, calls } = databaseMock({
      cohort_channels: { data: [{ id: 9 }, { id: -1 }, { id: Number.NaN }, { id: '10' }] },
    })
    await searchAulaFallback(client, 'notatki', { cohortId: 'cohort-a', channelKinds: ['wyk'] })
    assert.ok(hasCall(calls, 'cohort_channels', 'eq', 'cohort_id', 'cohort-a'))
    assert.ok(hasCall(calls, 'cohort_channels', 'limit', 100))
    assert.ok(hasCall(calls, 'cohort_messages', 'in', 'channel_id', [9]))
  })

  it('keeps the general-channel filter and ignores channel kinds in that mode', async () => {
    const { client, calls } = databaseMock()
    await searchAulaFallback(client, 'notatki', { cohortId: 'cohort-a', channelId: null, channelKinds: ['wyk'] })
    assert.ok(hasCall(calls, 'cohort_messages', 'is', 'channel_id', null))
    assert.equal(calls.some(call => call.table === 'cohort_channels'), false)
  })

  it('rejects wildcard-only searches before any database read', async () => {
    const { client, calls } = databaseMock()
    assert.deepEqual(await searchAnnouncementsFallback(client, '"()*', 10000), [])
    assert.deepEqual(await searchAulaFallback(client, '"()*', { cohortId: 'cohort-a' }), { hits: [], estimatedTotalHits: 0 })
    assert.deepEqual(calls, [])
  })

  it('returns no messages for an unrepresentable date instead of dropping its filter', async () => {
    const { client, calls } = databaseMock({ cohort_messages: { data: [message] } })
    const result = await searchAulaFallback(client, 'notatki', { cohortId: 'cohort-a', since: Number.MAX_VALUE })
    assert.deepEqual(result, { hits: [], estimatedTotalHits: 0 })
    assert.equal(calls.some(call => call.table === 'cohort_messages' && call.method === 'execute'), false)
  })
})
