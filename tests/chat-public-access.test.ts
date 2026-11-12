import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canUseChatTool, chatResponseScope, chatToolAccessScope } from '../api/_lib/chatAccess.ts'
import { buildResponseCacheKey } from '../api/_lib/chatResponseCache.ts'
import { registerTool, getToolEntry, toGroqToolsArray } from '../api/_lib/tools/registry.ts'
import '../api/_lib/tools/searchEvents.ts'
import '../api/_lib/tools/getCalendarInRange.ts'
import '../api/_lib/tools/getUpcomingUsosRegistrations.ts'
import '../api/_lib/tools/getLatestAnnouncements.ts'
import { buildToolFacts } from '../api/_lib/synthesizer.ts'
import { tryCapabilitiesReply } from '../api/_lib/capabilitiesReply.ts'
import { useChatStore } from '../src/store/useChatStore.ts'

function clientMock(rows: Record<string, unknown[]> = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const client = { from(table: string) {
    calls.push({ table, method: 'from', args: [] })
    const query: Record<string, unknown> = new Proxy({}, { get(_target, method) {
      if (method === 'then') return (resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve)
      return (...args: unknown[]) => { calls.push({ table, method: String(method), args }); return query }
    } })
    return query
  } } as unknown as SupabaseClient
  return { client, calls }
}

describe('anonymous Versuś access', () => {
  it('explains which questions work without an account', () => {
    const help = tryCapabilitiesReply('Co potrafisz?', false)
    assert.match(help ?? '', /bez logowania/i)
    assert.ok(help?.includes('po zalogowaniu'))
    assert.equal(tryCapabilitiesReply('Kiedy są rejestracje?', false), null)
  })
  it('allows public university information and rejects private, community and unknown tools', () => {
    for (const name of ['get_latest_announcements', 'get_announcement_details', 'get_upcoming_official_events', 'get_upcoming_usos_registrations', 'search_events']) assert.equal(canUseChatTool(name, null), true)
    for (const name of ['find_user', 'get_latest_posts', 'get_my_aula_overview', 'get_my_classes_in_range', 'get_unread_notifications', 'search_discounts', 'future_unknown_tool']) assert.equal(canUseChatTool(name, null), false)
    assert.equal(canUseChatTool('get_my_classes_in_range', 'user-a'), true)
  })

  it('denies private executors before any cache or data access', async () => {
    let reads = 0
    registerTool({ tool: { name: 'private_access_regression_probe', description: 'test', parameters: { type: 'object', properties: {} } }, execute: async () => { reads++; return { ok: true } } })
    const { client } = clientMock()
    const result = await getToolEntry('private_access_regression_probe')!.execute({}, { userId: null, supabaseAdmin: client })
    assert.equal((result as { requiresAuth: boolean }).requiresAuth, true)
    assert.equal(reads, 0)
    assert.equal(toGroqToolsArray(null).some(tool => tool.function.name === 'private_access_regression_probe'), false)
    assert.equal(toGroqToolsArray('user-a').some(tool => tool.function.name === 'private_access_regression_probe'), true)
  })

  it('does not search community events for anonymous requests', async () => {
    const anon = clientMock()
    await getToolEntry('search_events')!.execute({ query: 'konferencja' }, { userId: null, supabaseAdmin: anon.client })
    assert.deepEqual(anon.calls.filter(c => c.method === 'from').map(c => c.table), ['official_events'])
    const signedIn = clientMock()
    await getToolEntry('search_events')!.execute({ query: 'konferencja' }, { userId: 'user-a', supabaseAdmin: signedIn.client })
    assert.deepEqual(signedIn.calls.filter(c => c.method === 'from').map(c => c.table).sort(), ['events', 'official_events'])
  })

  it('limits anonymous registration tools to USOSweb-scraped records', async () => {
    const anon = clientMock()
    await getToolEntry('get_upcoming_usos_registrations')!.execute({}, { userId: null, supabaseAdmin: anon.client })
    assert.ok(anon.calls.some(c => c.method === 'not' && c.args[0] === 'source_usos_tura_id' && c.args[1] === 'is' && c.args[2] === null))
  })

  it('limits anonymous calendar queries to public source records', async () => {
    const anon = clientMock()
    await getToolEntry('get_calendar_in_range')!.execute({ range_start: '2026-11-06T00:00:00Z', range_end: '2026-11-12T23:00:00Z' }, { userId: null, supabaseAdmin: anon.client })
    assert.deepEqual(anon.calls.filter(c => c.method === 'from').map(c => c.table), ['calendar_entries'])
    assert.ok(anon.calls.some(c => c.method === 'or' && String(c.args[0]).includes('source_official_event_id.not.is.null')))
    assert.ok(anon.calls.some(c => c.method === 'neq' && c.args[0] === 'kind' && c.args[1] === 'community_event'))
  })

  it('separates guest and account tool caches and every user response cache', () => {
    assert.notEqual(chatToolAccessScope(null), chatToolAccessScope('user-a'))
    assert.notEqual(chatResponseScope('user-a'), chatResponseScope('user-b'))
    const prompt = 'Co nowego?'
    assert.notEqual(buildResponseCacheKey(prompt, true, null), buildResponseCacheKey(prompt, true, 'user-a'))
    assert.notEqual(buildResponseCacheKey(prompt, true, 'user-a'), buildResponseCacheKey(prompt, true, 'user-b'))
    assert.equal(buildResponseCacheKey(prompt, true), buildResponseCacheKey(prompt, true, null))
  })

  it('does not reuse follow-up answers across different anonymous conversations', () => {
    const historyA = [{ role: 'user', content: 'Termin rejestracji na kurs A' }, { role: 'user', content: 'A jutro?' }]
    const historyB = [{ role: 'user', content: 'Termin rejestracji na kurs B' }, { role: 'user', content: 'A jutro?' }]
    assert.notEqual(buildResponseCacheKey('A jutro?', true, null, historyA), buildResponseCacheKey('A jutro?', true, null, historyB))
    assert.equal(buildResponseCacheKey('Komunikaty', true, null, [{ role: 'user', content: 'Komunikaty' }]), buildResponseCacheKey('Komunikaty', true, null))
  })

  it('accepts post-pivot announcements and links guests to a public source', async () => {
    const announcements = ['info', 'event'].map((status) => ({
      id: `announcement-${status}`, title: `Tytuł ${status}`, lecturer_name: 'Komunikat wydziałowy',
      body: 'Treść ogólnego komunikatu z wydziału UJ', status,
      department: 'Wydział Polonistyki', source: 'WPOL', source_url: 'https://polonistyka.uj.edu.pl/komunikaty',
      created_at: '2026-11-06T10:00:00Z',
    }))
    const { client } = clientMock({ announcements })
    const result = await getToolEntry('get_latest_announcements')!.execute({}, { userId: null, supabaseAdmin: client })
    assert.equal((result as { ok: boolean }).ok, true)
    const facts = buildToolFacts('get_latest_announcements', result)
    assert.equal(facts.kind, 'direct')
    if (facts.kind !== 'direct') return
    assert.ok(facts.text.includes('Tytuł info'))
    assert.ok(facts.text.includes('https://polonistyka.uj.edu.pl/komunikaty'))
    assert.ok(facts.text.includes('dodano do UJverse'))
    assert.equal(facts.text.includes('/moj-plan'), false)
  })

  it('invalidates the previous conversation and transient states at an account boundary', () => {
    const state = useChatStore.getState()
    const generation = state.generation
    state.addMessage({ role: 'assistant', content: 'Personal conversation' })
    state.setTyping(true); state.setOpen(true); state.setError('old error')
    state.clearHistory()
    const cleared = useChatStore.getState()
    assert.equal(cleared.generation, generation + 1)
    assert.deepEqual(cleared.messages, [])
    assert.equal(cleared.isTyping, false)
    assert.equal(cleared.isOpen, false)
    assert.equal(cleared.error, null)
  })
})
