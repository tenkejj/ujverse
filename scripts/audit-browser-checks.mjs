/** Current audit acceptance checks. Public reads + disposable browser state only.
 * Optional Playwright Core dependency is supplied outside the app dependencies.
 * BASE_URL=http://127.0.0.1:5173 CHROME_PATH=/usr/bin/chromium node scripts/audit-browser-checks.mjs
 * PLAYWRIGHT_MODULE may point to an installed playwright-core/index.mjs.
 * AUDIT_OUTPUT_DIR selects screenshots/JSON; AUDIT_IMAGE_CACHE optionally supplies
 * exact cached public UJ image bytes where a managed browser cannot trust its TLS proxy.
 * Source clicks are activated with external navigation prevented by a test fixture;
 * no enrollment, application submission, private session or Groq inference is attempted.
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright-core'
)
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const output = process.env.AUDIT_OUTPUT_DIR ?? '/tmp/ujverse-audit-browser'
await mkdir(output, { recursive: true })
const cache = process.env.AUDIT_IMAGE_CACHE
  ? JSON.parse(await readFile(process.env.AUDIT_IMAGE_CACHE, 'utf8'))
  : []
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  locale: 'pl-PL',
  timezoneId: 'Europe/Warsaw',
  reducedMotion: 'reduce',
})
await context.addInitScript(() => {
  document.addEventListener(
    'click',
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest('a[target="_blank"]')
      )
        event.preventDefault()
    },
    true,
  )
})
const page = await context.newPage()
const errors = []
const checks = []
const indexRequests = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (request) => {
  if (/meilisearch|meili\./i.test(request.url()))
    indexRequests.push(request.url())
})
await page.route('https://www.uj.edu.pl/**', async (route) => {
  const e = cache.find((e) => e.url === route.request().url())
  if (e && route.request().resourceType() === 'image')
    return route.fulfill({
      status: e.status,
      body: await readFile(e.file),
      contentType: e.type,
    })
  return route.continue()
})
const check = (name, condition) => {
  assert.ok(condition, name)
  checks.push(name)
  console.log('PASS', name)
}
async function home() {
  await page.goto(base + '/')
  await page.locator('.action-radar').waitFor()
  await page
    .locator('.action-radar[aria-busy="true"]')
    .waitFor({ state: 'detached', timeout: 30000 })
}
try {
  await home()
  check(
    'anonymous homepage/radar',
    await page
      .getByRole('heading', { name: 'Nie przegap', exact: true })
      .isVisible(),
  )
  check(
    'radar displays at most three initial actions',
    (await page.locator('.action-radar-item').count()) <= 3,
  )
  const radarTop = await page.locator('.action-radar').boundingBox()
  const assistantTop = await page.locator('.versus-scene').boundingBox()
  check('source tasks precede assistant', radarTop.y < assistantTop.y)
  const marker = page.locator('.action-radar-item button[aria-pressed]').first()
  await marker.click()
  check(
    'radar acknowledgement changes',
    (await marker.getAttribute('aria-pressed')) === 'true',
  )
  await page.reload()
  await page
    .locator('.action-radar-item button[aria-pressed]')
    .first()
    .waitFor()
  check(
    'radar acknowledgement persists',
    (await page
      .locator('.action-radar-item button[aria-pressed]')
      .first()
      .getAttribute('aria-pressed')) === 'true',
  )
  if (await page.locator('.action-radar-expand').count()) {
    await page.locator('.action-radar-expand').click()
    check(
      'radar expands remaining actions',
      (await page.locator('.action-radar-item').count()) > 3,
    )
    await page.locator('.action-radar-expand').click()
  }
  await page.locator('.study-profile summary').click()
  await page.locator('.study-profile select').nth(0).selectOption('epi')
  await page.locator('.study-profile select').nth(1).selectOption('first')
  await page.locator('.study-profile select').nth(2).selectOption('1')
  check(
    'programme choice reuses faculty',
    (await page
      .getByRole('button', { name: /Twój wydział: Wydział Zarządzania/ })
      .count()) === 1,
  )
  await page.reload()
  await page.locator('.study-profile summary').click()
  check(
    'programme persists',
    (await page.locator('.study-profile select').nth(0).inputValue()) === 'epi',
  )
  check(
    'study year persists',
    (await page.locator('.study-profile select').nth(2).inputValue()) === '1',
  )
  await page.getByRole('button', { name: /Twój wydział:/ }).click()
  await page.getByLabel('Szukaj wydziału', { exact: true }).fill('filozof')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Wydział Filozoficzny/ })
    .click()
  check(
    'faculty switch deactivates mismatched programme',
    (await page.locator('.study-profile select').nth(0).inputValue()) === '',
  )
  await page.goto(base + '/poradniki/stypendium-rektora')
  await page
    .getByRole('heading', {
      name: 'Jak złożyć wniosek o stypendium rektora?',
      exact: true,
    })
    .waitFor()
  const step = page
    .getByRole('checkbox', { name: /Oznacz jako wykonane/ })
    .first()
  await step.focus()
  await step.press('Space')
  check('guide progress works by keyboard', await step.isChecked())
  await page.reload()
  check(
    'guide progress persists',
    await page
      .getByRole('checkbox', { name: /Oznacz jako wykonane/ })
      .first()
      .isChecked(),
  )
  check(
    'scholarship past deadline is explicit',
    (await page.locator('main').innerText()).includes('już upłynął'),
  )
  await page.goto(base + '/poradniki/akademik')
  check(
    'guide progress does not leak across procedures',
    !(await page
      .getByRole('checkbox', { name: /Oznacz jako wykonane/ })
      .first()
      .isChecked()),
  )
  check(
    'housing CM limitation explicit',
    (await page.locator('main').innerText()).includes('poza Collegium Medicum'),
  )
  await page.goto(base + '/szukaj?q=stypendium%20rektora')
  await page
    .getByRole('link', { name: /Stypendium rektora — krok po kroku/ })
    .first()
    .waitFor({ timeout: 30000 })
  check('search discovers procedural guides', true)
  await page.goto(base + '/wydarzenia')
  await page
    .locator('.info-calendar-days button[aria-pressed="true"]')
    .waitFor({ timeout: 30000 })
  let before = new URL(page.url()).search
  await page.locator('.info-calendar-days button[aria-pressed="true"]').focus()
  await page.keyboard.press('ArrowRight')
  check(
    'calendar keyboard selection updates URL',
    new URL(page.url()).search !== before,
  )
  for (const path of ['/moj-plan', '/aula', '/search']) {
    await page.goto(base + path)
    await page.getByRole('heading', { name: /potrzebne konto/ }).waitFor()
    check(
      'contextual auth ' + path,
      (
        await page
          .locator('main')
          .getByRole('link', { name: 'Zaloguj się', exact: true })
          .getAttribute('href')
      ).includes('next='),
    )
  }
  await home()
  await page.locator('.pilot-participation summary').click()
  check(
    'pilot is opt-in',
    !(await page
      .getByRole('checkbox', {
        name: 'Zgadzam się na ten lokalny pomiar pilotażu',
        exact: true,
      })
      .isChecked()),
  )
  await page
    .getByRole('checkbox', {
      name: 'Zgadzam się na ten lokalny pomiar pilotażu',
      exact: true,
    })
    .check()
  await page.locator('.pilot-participation select').selectOption('scholarship')
  await page
    .getByRole('button', { name: 'Zacznij zadanie', exact: true })
    .click()
  await page.goto(base + '/poradniki/stypendium-rektora')
  await page.locator('.student-guide-step-sources a').first().click()
  let report = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ujverse.pilotMetrics.v1')),
  )
  check(
    'matching official-source activation completes pilot task',
    report.taskResults.length === 1 &&
      report.taskResults[0].task === 'scholarship',
  )
  check(
    'pilot stores no question, URL or account fields',
    !JSON.stringify(report).includes('http') &&
      !JSON.stringify(report).includes('userId'),
  )
  await home()
  await page.locator('.pilot-participation summary').click()
  await page.getByRole('button', { name: 'Usuń pomiar', exact: true }).click()
  check(
    'pilot erase removes collected data',
    await page.evaluate(
      () => localStorage.getItem('ujverse.pilotMetrics.v1') === null,
    ),
  )
  for (const [width, theme] of [
    [320, 'dark'],
    [390, 'uj'],
    [768, 'light'],
    [1440, 'light'],
    [2560, 'uj'],
  ]) {
    await page.setViewportSize({ width, height: width > 1440 ? 1440 : 1000 })
    await page.evaluate((t) => localStorage.setItem('uj-theme', t), theme)
    await page.reload()
    await page.locator('.action-radar').waitFor()
    check(
      'no horizontal overflow ' + width,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    await page.screenshot({
      path: output + '/final-home-' + width + '.png',
      fullPage: width < 768,
    })
  }
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(base + '/poradniki/stypendium-rektora')
  check(
    'guide readable at320',
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await page.screenshot({
    path: output + '/final-guide-320.png',
    fullPage: true,
  })
  await page.route('**/rest/v1/official_events*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Synthetic source outage"}',
    }),
  )
  await home()
  await page.locator('.dashboard-discover [role="alert"]').waitFor({ timeout: 30000 })
  check(
    'event source failure remains local',
    /Nie udało|Spróbuj|problem/i.test(
      await page.locator('.dashboard-discover').innerText(),
    ),
  )
  check(
    'other source content survives',
    (await page.locator('.dashboard-stories .info-entry').count()) > 0,
  )
  check('no browser index requests', indexRequests.length === 0)
  check('no JavaScript page errors', errors.length === 0)
  await writeFile(
    output + '/browser-regression.json',
    JSON.stringify(
      {
        checks,
        errors,
        passed: checks.length,
        indexRequests: indexRequests.length,
        notes: [
          'Official source clicks activated in UI with navigation prevented by test fixture; actual enrollment was not attempted.',
          'Public data was read anonymously through local trusted TLS proxy; no private sessions or Groq calls.',
        ],
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ passed: checks.length, errors }, null, 2))
} finally {
  await browser.close()
}
