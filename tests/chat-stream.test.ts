import assert from 'node:assert/strict'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { describe, it } from 'node:test'
import { createStreamPresenter, markdownBlocks, readSSEFrames, streamingMarkdownTail, STREAM_FRAME_MS, STREAM_MAX_LAG_MS } from '../src/lib/chatStream.ts'
import { VERSUS_QUESTION_SUGGESTIONS } from '../src/lib/chatQuickPrompts.ts'
import { tryGuideReply } from '../api/_lib/guideReplies.ts'

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []; for await (const value of source) result.push(value); return result
}

function harness(reduced = false) {
  let now = 0
  let id = 0
  const jobs = new Map<number, () => void>()
  const received: Array<{ at: number; text: string }> = []
  const presenter = createStreamPresenter({
    publish: text => received.push({ at: now, text }), immediate: () => reduced,
    now: () => now,
    schedule: callback => { jobs.set(++id, callback); return id as unknown as ReturnType<typeof setTimeout> },
    unschedule: timer => { jobs.delete(timer as unknown as number) },
  })
  return { presenter, received, jobs, setReduced: () => { reduced = true },
    tick() { now += STREAM_FRAME_MS; const batch = [...jobs.values()]; jobs.clear(); batch.forEach(callback => callback()) },
    text: () => received.map(entry => entry.text).join(''),
  }
}

describe('SSE framing — simulated transport, no AI provider', () => {
  it('preserves Polish and emoji at every byte boundary, LF and CRLF', async () => {
    for (const newline of ['\n', '\r\n']) {
      const frames = [': ping', 'data: {"choices":[{"delta":{"content":"Zażółć 🦉"}}]}', 'data: [DONE]']
      const bytes = new TextEncoder().encode(frames.join(newline + newline) + newline + newline)
      for (const size of [1, 2, 3, 17, bytes.length]) {
        const stream = new ReadableStream<Uint8Array>({ start(controller) {
          for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
          controller.close()
        } })
        assert.deepEqual(await collect(readSSEFrames(stream)), frames)
      }
    }
  })
  it('flushes the final unterminated frame and cancels when the consumer exits', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: first\n\ndata: second')) }, cancel() { cancelled = true } })
    for await (const frame of readSSEFrames(stream)) { assert.equal(frame, 'data: first'); break }
    assert.equal(cancelled, true)
    const tail = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: tail')); c.close() } })
    assert.deepEqual(await collect(readSSEFrames(tail)), ['data: tail'])
  })
})

describe('bounded stream presentation', () => {
  it('shows the first text immediately and coalesces fast single-character deltas', () => {
    const h = harness()
    h.presenter.push('A')
    assert.deepEqual(h.received, [{ at: 0, text: 'A' }])
    for (const character of 'bcdefghijklmnop') h.presenter.push(character)
    assert.equal(h.received.length, 1)
    h.tick(); h.tick(); h.tick()
    assert.equal(h.text(), 'Abcdefghijklmnop')
    assert.ok(h.received.length <= 4)
  })
  it('bounds a large burst without losing text and stops when idle', () => {
    const h = harness(), content = '## Tytuł\n\nTekst 🦉 '.repeat(600)
    h.presenter.push(content)
    assert.ok(h.text().length > 0)
    for (let i = 0; i < STREAM_MAX_LAG_MS / STREAM_FRAME_MS; i++) h.tick()
    assert.equal(h.text(), content)
    assert.equal(h.jobs.size, 0)
  })
  it('handles slow and irregular chunks, completion, cancellation and a fresh retry', () => {
    for (const chunks of [['Krótko.'], ['a', 'b', 'c'], ['Pierwszy blok ', 'x'.repeat(3000), '\n\nKoniec']]) {
      const h = harness()
      for (const [i, chunk] of chunks.entries()) { h.presenter.push(chunk); for (let n = 0; n < (i % 3) + 1; n++) h.tick() }
      h.presenter.flush(); h.presenter.dispose()
      assert.equal(h.text(), chunks.join(''))
      assert.equal(h.jobs.size, 0)
    }
    const cancelled = harness(); cancelled.presenter.push('otrzymane'.repeat(100)); cancelled.presenter.flush(); cancelled.presenter.dispose()
    const atCancel = cancelled.text(); cancelled.tick(); assert.equal(cancelled.text(), atCancel)
    const retry = harness(); retry.presenter.push('ponowienie'); retry.presenter.flush(); assert.equal(retry.text(), 'ponowienie')
  })
  it('supports both initial reduced motion and changes during generation', () => {
    const h = harness(true); h.presenter.push('pełna odpowiedź'.repeat(200)); assert.equal(h.jobs.size, 0)
    const active = harness(); active.presenter.push('długi tekst'.repeat(100)); active.setReduced(); active.tick()
    assert.equal(active.text(), 'długi tekst'.repeat(100)); assert.equal(active.jobs.size, 0)
  })
})

describe('incremental Markdown boundaries', () => {
  it('retains every byte for headings, lists, links, tables and fenced code', () => {
    const samples = [
      '# Nagłówek\n\nAkapit [UJ](https://uj.edu.pl).\n\nKoniec.',
      '- Jeden\n\n- Dwa\n  - Podpunkt\n\nNastępny akapit',
      '```ts\nconst text = "a"\n\nconsole.log(text)\n```\n\nKoniec.',
      '| A | B |\n| - | - |\n| 1 | 2 |\n\nAkapit',
      '~~~\n\n# To jest kod\n~~~\n\nTekst',
    ]
    for (const sample of samples) for (let end = 1; end <= sample.length; end++) {
      const prefix = sample.slice(0, end)
      assert.equal(markdownBlocks(prefix).join(''), prefix)
    }
    assert.equal(markdownBlocks(samples[1]).length, 2)
    assert.equal(markdownBlocks(samples[2]).length, 2)
  })
  it('keeps reference definitions in document context and completed blocks stable', () => {
    const ref = '[UJ][uni]\n\n[uni]: https://uj.edu.pl'
    assert.deepEqual(markdownBlocks(ref), [ref])
    assert.equal(markdownBlocks('Pierwszy.\n\nDrugi.')[0], markdownBlocks('Pierwszy.\n\nDrugi, dłuższy.')[0])
  })
})

describe('public question suggestions', () => {
  it('contains ten distinct actionable questions, with procedure examples backed by guides', () => {
    assert.equal(new Set(VERSUS_QUESTION_SUGGESTIONS.map(p => p.question)).size, 10)
    for (const prompt of VERSUS_QUESTION_SUGGESTIONS) {
      assert.ok(prompt.label && prompt.question.endsWith('?'))
      assert.doesNotMatch(prompt.question, /mój|moim|moje|moich|plan zajęć/i)
    }
    for (const i of [0, 1, 2, 6, 7, 8, 9]) assert.ok(tryGuideReply(VERSUS_QUESTION_SUGGESTIONS[i].question))
  })
})


it('renders segmented Markdown with the same semantics as a complete document', () => {
  const render = (text: string) => createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], children: text })
  const normalize = (html: string) => html.replace(/>\s+</g, '><')
  const documents = [
    '# Tytuł\n\nTekst [UJ](https://uj.edu.pl).\n\n## Sekcja\n\nDalszy tekst.',
    '- Jeden\n\n- Dwa\n  - Podpunkt\n\nAkapit po liście',
    '```ts\nconst x = 1\n\nconsole.log(x)\n```\n\nKoniec',
    '| A | B |\n| - | - |\n| 1 | 2 |\n\nKoniec',
    '> Cytat\n>\n> Dalej\n\nKoniec',
    '[Link][ref]\n\n[ref]: https://uj.edu.pl',
    'Tytuł\n=====\n\nAkapit',
  ]
  for (const document of documents) {
    assert.equal(normalize(renderToStaticMarkup(createElement(Fragment, null, ...markdownBlocks(document).map(render)))), normalize(renderToStaticMarkup(render(document))))
  }
})


it('keeps unfinished link targets out of layout while preserving code', () => {
  assert.equal(streamingMarkdownTail('Źródło: [UJ](https://uj.edu'), 'Źródło: UJ')
  assert.equal(streamingMarkdownTail('Źródło: [UJ](https://uj.edu.pl)'), 'Źródło: [UJ](https://uj.edu.pl)')
  assert.equal(streamingMarkdownTail('```md\n[UJ](https://uj.edu'), '```md\n[UJ](https://uj.edu')
  assert.equal(streamingMarkdownTail('`[UJ](https://uj.edu'), '`[UJ](https://uj.edu')
})

it('drains completion within the existing budget and resolves cancellation', async () => {
  const h = harness()
  h.presenter.push('tekst'.repeat(1000))
  const finished = h.presenter.finish()
  h.tick(); h.tick(); h.tick()
  await finished
  assert.equal(h.text(), 'tekst'.repeat(1000))
  assert.equal(h.jobs.size, 0)
  h.presenter.push('następny'.repeat(100))
  const cancelled = h.presenter.finish()
  h.presenter.flush(); h.presenter.dispose()
  await cancelled
  assert.equal(h.jobs.size, 0)
})

it('retains HTML block context and never reveals half a surrogate pair', () => {
  const html = '<div>\n\nTekst\n\n</div>'
  assert.deepEqual(markdownBlocks(html), [html])
  const h = harness()
  h.presenter.push('x'.repeat(23) + '🦉' + 'koniec')
  assert.ok(h.received[0].text.endsWith('🦉'))
  h.presenter.flush()
  assert.equal(h.text(), 'x'.repeat(23) + '🦉' + 'koniec')
})
