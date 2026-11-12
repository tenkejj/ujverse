/** Anonymous AI entry/streaming UI regression checks. SSE responses are simulated; no Groq key is used. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pl-PL' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const requests = []
let fail = false
const reply = 'Sprawdziłem publiczne informacje UJ. Szczegóły znajdziesz w oficjalnym źródle.'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization' }
await context.route('**/api/chat', route => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  requests.push({ body: route.request().postDataJSON(), hasAuth: Boolean(route.request().headers().authorization) })
  if (fail) return route.fulfill({ status: 503, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: 'temporary failure' }) })
  const body = `data: ${JSON.stringify({ meta: { tool: 'get_latest_announcements', label: 'Sprawdzam komunikaty…' } })}\n\ndata: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`
  return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body })
})
let checks = 0
function check(name, condition) { assert.ok(condition, name); checks++; console.log('PASS', name) }

try {
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { name: 'Zapytaj Versusia AI' }).waitFor()
  check('dashboard exposes a labelled AI question field', await page.getByRole('textbox', { name: 'O co chcesz zapytać Versusia?' }).isVisible())
  check('sidebar has a primary Versuś link', await page.getByRole('navigation', { name: 'Sekcje UJverse' }).getByRole('link', { name: /Versuś AI/ }).isVisible())
  check('search has no visible keyboard shortcut badge', await page.locator('header kbd').count() === 0)
  await page.keyboard.press('Control+k')
  check('keyboard shortcut remains functional', await page.evaluate(() => document.activeElement?.id === 'header-info-search'))
  const faculty = page.getByRole('button', { name: /^Wydział:/ })
  check('faculty control explicitly says Wydział and is at least 44px high', (await faculty.boundingBox()).height >= 44 && (await faculty.innerText()).includes('Wydział:'))
  await page.getByRole('textbox', { name: 'O co chcesz zapytać Versusia?' }).fill('Co nowego na UJ?')
  await page.getByRole('button', { name: 'Zapytaj Versusia', exact: true }).click()
  await page.waitForURL(`${BASE}/chat`)
  await page.getByText(reply, { exact: true }).waitFor({ timeout: 15000 })
  check('guest gets a streamed answer without an auth gate', await page.getByRole('heading', { name: /^Versuś$/i }).isVisible())
  check('dashboard handoff sends exactly one request', requests.length === 1)
  check('anonymous chat carries no Authorization header', requests[0].hasAuth === false)
  check('question is forwarded to the AI', requests[0].body.messages.some(m => m.role === 'user' && m.content === 'Co nowego na UJ?'))
  await page.reload()
  await page.getByRole('textbox', { name: 'Wiadomość do Versusia' }).waitFor()
  check('reload does not submit the handoff again', requests.length === 1)
  check('guest suggestions omit private plan and Aula prompts', await page.getByRole('button', { name: 'Co mam dziś w planie?', exact: true }).count() === 0 && await page.getByRole('button', { name: 'Co w Auli?', exact: true }).count() === 0)
  await page.getByRole('button', { name: 'Najnowsze ogłoszenia', exact: true }).click()
  await page.getByText(reply, { exact: true }).waitFor({ timeout: 15000 })
  check('public suggestion sends a real chat request', requests.length === 2)
  await page.getByRole('button', { name: 'Rozpocznij nową rozmowę z asystentem' }).click()
  await page.getByRole('heading', { name: 'Co chcesz wiedzieć o UJ?' }).waitFor()
  check('new conversation clears previous messages', await page.getByText(reply, { exact: true }).count() === 0)
  fail = true
  await page.getByRole('textbox', { name: 'Wiadomość do Versusia' }).fill('Pytanie testowe')
  await page.getByRole('button', { name: 'Wyślij wiadomość' }).click()
  await page.getByRole('alert').filter({ hasText: 'Nie udało się uzyskać odpowiedzi' }).waitFor()
  check('API failure is actionable rather than an empty answer', true)
  fail = false

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/`)
  const mobileFaculty = page.getByRole('button', { name: /^Wydział:/ })
  await mobileFaculty.waitFor()
  const top = (await mobileFaculty.boundingBox()).y
  await page.evaluate(() => window.scrollTo(0, 1200))
  check('faculty stays available after mobile scrolling', Math.abs((await mobileFaculty.boundingBox()).y - top) <= 1)
  await mobileFaculty.click()
  await page.getByRole('dialog', { name: 'Wybierz wydział' }).getByRole('button', { name: /Cały UJ/ }).click()
  check('faculty label stays visible after choosing Cały UJ', (await mobileFaculty.innerText()).includes('Wydział:') && (await mobileFaculty.innerText()).includes('Cały UJ'))
  check('one faculty control is visible on mobile', await page.getByRole('button', { name: /^Wydział:/ }).count() === 1)
  const fab = page.getByRole('button', { name: 'Otwórz Versusia', exact: true })
  await fab.click()
  const dialog = page.getByRole('dialog', { name: /^Versuś$/i })
  await dialog.waitFor()
  check('floating Versuś opens for a guest', await dialog.getByRole('textbox', { name: 'Wiadomość do Versusia' }).isVisible())
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  check('Escape closes AI and returns focus to its trigger', await fab.evaluate(el => el === document.activeElement))
  await page.goto(`${BASE}/chat`)
  await page.getByRole('textbox', { name: 'Wiadomość do Versusia' }).waitFor()
  const inputBox = await page.getByRole('textbox', { name: 'Wiadomość do Versusia' }).boundingBox()
  check('mobile composer fits above bottom navigation', inputBox.y + inputBox.height <= 844 - 60)
  check('mobile chat has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('no uncaught page errors', errors.length === 0)
  console.log(`${checks}/${checks} checks passed (simulated SSE responses)`)
} finally { await browser.close() }
