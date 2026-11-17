/** Reproducible redesign checks. Synthetic public fixtures; no account or writes.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node scripts/redesign-browser-checks.mjs
 * BASE_URL defaults to production preview on 4173. BEFORE_URL optionally captures
 * the preserved baseline with identical fixtures. Browser must be permitted by sandbox.
 */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core')
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const output = process.env.REDESIGN_OUTPUT ?? 'docs/redesign/screenshots'
const widths = [320, 390, 768, 1024, 1440, 1920, 2560]
const routes = ['/', '/komunikaty', '/rejestracje', '/wydarzenia', '/szukaj', '/poradniki', '/niezbednik']
const now = new Date('2026-11-17T09:00:00Z')
const announcements = Array.from({ length: 45 }, (_, i) => ({
  id: `redesign-announcement-${i}`, department: 'Wydział Matematyki i Informatyki',
  source: 'Dane testowe — wydział', source_kind: 'liferay', status: i % 3 ? 'info' : 'cancelled',
  title: `Komunikat testowy ${i + 1}: informacje o organizacji zajęć i zapisach na przedmioty w semestrze zimowym`,
  body: 'Przykładowa treść do testów interfejsu. '.repeat(24),
  source_url: `https://matinf.uj.edu.pl/test-${i}`, created_at: new Date(+now - i * 3600000).toISOString(),
}))
const registrations = Array.from({ length: 8 }, (_, i) => ({
  id: `redesign-registration-${i}`, source_usos_tura_id: `test-${i}`, source_unit_code: 'WMI',
  title: `Przedmiot testowy ${i + 1} — bardzo długa nazwa rejestracji wymagająca poprawnego zawijania tekstu`,
  audience_label: 'Jednostka testowa', kind: 'inne', updated_at: now.toISOString(),
  opens_at: new Date(+now + (i - 3) * 86400000).toISOString(),
  closes_at: new Date(+now + (i + 2) * 86400000).toISOString(),
  registration_url: 'https://usosweb.uj.edu.pl/',
}))
const events = Array.from({ length: 8 }, (_, i) => ({
  id: `redesign-event-${i}`, external_id: `test-${i}`, title: `Wydarzenie testowe ${i + 1} — spotkanie społeczności akademickiej`,
  date: new Date(+now + (i + 1) * 86400000).toISOString(), scraped_at: now.toISOString(),
  description: 'Opis wydarzenia do testów.', source_name: 'Kalendarz testowy',
  event_url: `https://www.uj.edu.pl/kalendarz-test-${i}`, image_url: null,
}))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  const context = await browser.newContext({ locale: 'pl-PL', timezoneId: 'Europe/Warsaw', reducedMotion: 'reduce' })
  let responseMode = 'ready'
  await context.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url())
    if (responseMode === 'error') return route.fulfill({ status: 503, json: { message: 'Testowy błąd źródła' } })
    let data = responseMode === 'empty' ? [] : url.pathname.endsWith('/announcements') ? announcements : url.pathname.endsWith('/usos_registrations') ? registrations : url.pathname.endsWith('/official_events') ? events : []
    if (url.searchParams.get('select') === 'full_body') data = { full_body: 'Pełna treść do testów rozwijania. '.repeat(80) }
    await route.fulfill({ status: 200, json: data })
  })
  await context.addInitScript(() => localStorage.setItem('uj-theme', 'dark'))
  const page = await context.newPage()
  await page.clock.setFixedTime(now)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const geometry = []
  for (const [version, url] of [['after', base], ...(process.env.BEFORE_URL ? [['before', process.env.BEFORE_URL]] : [])]) {
    for (const route of routes) {
      await page.goto(url + route)
      await page.locator('main h1').waitFor()
      if (route === '/') await page.locator('.dashboard-stories article').first().waitFor()
      if (route === '/komunikaty') await page.locator('main .info-entry').first().waitFor()
      if (route === '/rejestracje') await page.locator('.deadline-entry').first().waitFor()
      if (route === '/wydarzenia') await page.locator('.info-calendar-days button').first().waitFor()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1080 })
        for (const theme of ['light', 'dark', 'uj']) {
          await page.evaluate(theme => {
            document.documentElement.classList.toggle('dark', theme !== 'light')
            document.documentElement.classList.toggle('theme-uj', theme === 'uj')
          }, theme)
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
          assert.ok(result.scrollWidth <= width, `${version} ${route} ${width} ${theme}: overflow`)
          geometry.push({ version, route, theme, ...result })
          if ([390, 1920].includes(width)) {
            await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({ path: `${output}/${version}-${route.slice(1) || 'home'}-${theme}-${width}.png`, fullPage: true })
          }
        }
      }
    }
  }
  await page.goto(base + '/komunikaty')
  await page.locator('main .info-entry').first().waitFor()
  assert.equal(await page.locator('main .info-entry').count(), 20)
  await page.getByRole('link', { name: 'Załaduj więcej komunikatów' }).click()
  assert.equal(await page.locator('main .info-entry').count(), 40)
  const disclosure = page.getByRole('button', { name: 'Czytaj treść', exact: true }).first()
  await disclosure.click()
  assert.equal(await disclosure.getAttribute('aria-expanded'), 'true')
  await page.getByRole('searchbox', { name: 'Szukaj w komunikatach' }).fill('zzzznieistniejący')
  await page.getByText('Żaden komunikat nie pasuje').waitFor()
  await page.goto(base + '/wydarzenia')
  await page.locator('.info-calendar-days button').first().waitFor()
  const selected = page.locator('.info-calendar-days button[aria-pressed=true]')
  const before = await selected.getAttribute('aria-label')
  await selected.press('ArrowRight')
  assert.notEqual(await selected.getAttribute('aria-label'), before)
  await page.setViewportSize({ width: 1024, height: 480 })
  const footer = await page.locator('.sidebar-controls').boundingBox()
  assert.ok(footer.y + footer.height <= 480)
  await page.getByRole('button', { name: 'Zwiń nawigację', exact: true }).click()
  assert.equal((await page.locator('.app-sidebar').boundingBox()).width, 72)
  await page.getByRole('button', { name: 'Rozwiń nawigację', exact: true }).click()
  for (const mode of ['empty', 'error']) {
    responseMode = mode
    await page.goto(base + '/komunikaty')
    await page.getByText(mode === 'empty' ? 'Brak nowych komunikatów' : 'Nie udało się').first().waitFor()
  }
  assert.deepEqual(errors, [])
  await writeFile(`${output}/playwright-results.json`, JSON.stringify({ geometry, errors }, null, 2))
  console.log(`PASS: ${geometry.length} responsive cases, disclosure, load more, empty/error, keyboard calendar and short/collapsed sidebar.`)
} finally { await browser.close() }
