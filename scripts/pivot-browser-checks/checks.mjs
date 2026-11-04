/**
 * Przeglądarkowe testy akceptacyjne pivotu (gość, bez logowania).
 *
 * Uruchomienie (poza zależnościami projektu):
 *   npm i --no-save playwright-core
 *   npm run dev -- --host 127.0.0.1 --port 5173      # z VITE_SUPABASE_* w .env.local
 *   BASE_URL=http://127.0.0.1:5173 CHROME_PATH=/usr/bin/google-chrome \
 *     node scripts/pivot-browser-checks/checks.mjs
 *
 * Scenariusze E/F podmieniają odpowiedzi REST rejestracji/wydarzeń na dane
 * testowe (route interception) i przerywają zapytanie o komunikaty — tylko
 * w przeglądarce testowej, nic nie trafia do bazy.
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const results = []
const consoleErrors = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
})

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, locale: 'pl-PL', timezoneId: 'Europe/Warsaw' })
  const page = await context.newPage()
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text().slice(0, 200)}`)
  })
  return { context, page }
}

const noOverflow = async (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

// ── A: anonymous visitor, desktop ─────────────────────────────────────────
{
  const { context, page } = await newPage({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { level: 1, name: /Wszystko, co ważne na UJ/ }).waitFor()
  record('A1 dashboard H1 visible at / without login', true)
  record('A2 no login form on /', (await page.locator('#auth-username').count()) === 0)
  await page.locator('article').first().waitFor({ timeout: 15000 })
  const annCount = await page.getByRole('heading', { name: 'Najnowsze komunikaty' }).locator('xpath=ancestor::section').locator('article').count()
  record('A3 real announcements rendered for anon', annCount > 0, `${annCount} items`)
  const sourceLinks = await page.getByRole('link', { name: /Sprawdź w źródle|Lista komunikatów wydziału/ }).count()
  record('D1 announcements link to sources', sourceLinks > 0, `${sourceLinks} links`)
  const firstHref = await page.getByRole('link', { name: /Sprawdź w źródle/ }).first().getAttribute('href')
  record('D2 source link is an https UJ URL', /^https:\/\/[^/]*uj\.edu\.pl/.test(firstHref ?? ''), firstHref ?? '')
  const addedLabel = await page.locator('time', { hasText: 'dodano' }).first().getAttribute('title')
  record('J1 announcement date labelled as "added to UJverse"', /Dodano do UJverse/.test(addedLabel ?? ''), addedLabel ?? '')
  const unavailable = await page.getByText('Dane o rejestracjach z USOSweb są chwilowo niedostępne.').count()
  record('J2 registrations without anon access shown as unavailable, not empty', unavailable === 1)

  // Ctrl+K focuses header search
  await page.keyboard.press('Control+k')
  const focusedId = await page.evaluate(() => document.activeElement?.id)
  record('S1 Ctrl+K focuses header search', focusedId === 'header-info-search', focusedId ?? 'none')
  await page.keyboard.type('stypendium')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/szukaj\?q=stypendium/)
  await page.getByRole('heading', { name: /Komunikaty \(\d+\)/ }).waitFor({ timeout: 15000 })
  const searchHeading = await page.getByRole('heading', { name: /Komunikaty \(\d+\)/ }).textContent()
  record('S2 header search → /szukaj shows announcement results', true, searchHeading ?? '')
  const fallbackNote = await page.getByText(/Pełnotekstowa wyszukiwarka jest chwilowo niedostępna/).count()
  record('S3 Meili unavailable → honest fallback notice', fallbackNote === 1)
  const socialLink = await page.getByRole('link', { name: 'Szukaj w społeczności' }).count()
  record('S4 anon search does not offer social search', socialLink === 0)

  // Back/forward
  await page.goBack()
  await page.getByRole('heading', { level: 1, name: /Wszystko, co ważne na UJ/ }).waitFor()
  record('N1 browser back returns to dashboard', true)
  await page.goForward()
  await page.waitForURL(/\/szukaj/)
  record('N2 browser forward returns to search', true)

  // Sidebar navigation
  for (const [label, path, h1] of [
    ['Komunikaty', '/komunikaty', 'Komunikaty'],
    ['Rejestracje', '/rejestracje', 'Rejestracje USOS'],
    ['Wydarzenia', '/wydarzenia', 'Wydarzenia na UJ'],
    ['Niezbędnik', '/niezbednik', 'Niezbędnik studenta'],
    ['Start', '/', 'Wszystko, co ważne na UJ, w jednym miejscu'],
  ]) {
    await page.getByRole('navigation', { name: 'Sekcje UJverse' }).getByRole('button', { name: label, exact: true }).click()
    await page.waitForURL(`${BASE}${path}`)
    await page.getByRole('heading', { level: 1, name: h1 }).waitFor()
    record(`N3 sidebar → ${path}`, true)
  }
  await context.close()
}

// ── B: faculty selection + persistence ────────────────────────────────────
{
  const { context, page } = await newPage({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`)
  await page.locator('article').first().waitFor({ timeout: 15000 })
  await page.getByRole('banner').getByRole('button', { name: /Wydział:/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Wybierz wydział' })
  await dialog.waitFor()
  const focusedInDialog = await page
    .waitForFunction(() => !!document.activeElement?.closest('[role="dialog"]'), null, { timeout: 2000 })
    .then(() => true, () => false)
  record('B0 faculty dialog receives focus', focusedInDialog)
  await dialog.getByRole('button', { name: /Wydział Zarządzania i Komunikacji Społecznej/ }).click()
  await dialog.waitFor({ state: 'detached' })
  await page.getByRole('heading', { name: 'Komunikaty z Twojego wydziału' }).waitFor()
  record('B1 selecting WZiKS changes the section to the faculty view', true)
  const stored = await page.evaluate(() => localStorage.getItem('ujverse.infoPrefs.v1'))
  record('B2 choice stored in versioned localStorage key', /Zarządzania/.test(stored ?? ''), stored ?? '')
  await page.waitForTimeout(1500)
  const metas = await page.getByRole('heading', { name: 'Komunikaty z Twojego wydziału' }).locator('xpath=ancestor::section').locator('article').allTextContents()
  const allWziks = metas.length === 0 || metas.every((t) => t.includes('WZiKS'))
  record('B3 announcements filtered to WZiKS (or honest empty state)', allWziks, `${metas.length} items`)
  await page.reload()
  await page.getByRole('heading', { name: 'Komunikaty z Twojego wydziału' }).waitFor()
  const label = await page.getByRole('banner').getByRole('button', { name: /Wydział:/ }).textContent()
  record('B4 selection persists after refresh', /WZiKS/.test(label ?? ''), label ?? '')
  await page.getByRole('banner').getByRole('button', { name: /Wydział:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Cały UJ/ }).click()
  await page.getByRole('heading', { name: 'Najnowsze komunikaty' }).waitFor()
  record('B5 return to all-university view', true)
  const keyboardEscape = await (async () => {
    await page.getByRole('banner').getByRole('button', { name: /Wydział:/ }).click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    return page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'dialog')
  })()
  record('B6 Escape closes dialog and returns focus to trigger', keyboardEscape)
  await context.close()
}

// ── G/H: protected routes and legacy deep links (anonymous) ───────────────
{
  const { context, page } = await newPage({ width: 1280, height: 900 })
  for (const [path, feature] of [
    ['/moj-plan', 'Mój plan'],
    ['/aula', 'Aula'],
    ['/spolecznosc', 'Społeczność'],
    ['/thread/123', 'Wpis społeczności'],
    ['/profile/jan', 'Profil studenta'],
    ['/usos', 'Alarmy rejestracji'],
    ['/events', 'Wydarzenia społeczności'],
  ]) {
    await page.goto(`${BASE}${path}`)
    await page.getByRole('heading', { level: 1, name: `${feature} — potrzebne konto` }).waitFor({ timeout: 10000 })
    const href = await page.getByRole('link', { name: 'Zaloguj się', exact: true }).last().getAttribute('href')
    record(`G1 ${path} shows AuthRequired with return path`, href === `/logowanie?next=${encodeURIComponent(path)}`, href ?? '')
    record(`G2 ${path} keeps the URL (no redirect to feed)`, new URL(page.url()).pathname === path)
  }
  await page.goto(`${BASE}/logowanie?next=%2Fmoj-plan`)
  await page.locator('#auth-username').waitFor()
  const browseHref = await page.getByRole('link', { name: 'Przeglądaj bez konta' }).getAttribute('href')
  record('G3 /logowanie shows form + "Przeglądaj bez konta" back to next', browseHref === '/moj-plan', browseHref ?? '')
  await page.goto(`${BASE}/logowanie?next=https%3A%2F%2Fevil.example`)
  const evilHref = await page.getByRole('link', { name: 'Przeglądaj bez konta' }).getAttribute('href')
  record('G4 open redirect via ?next= rejected', evilHref === '/', evilHref ?? '')
  await page.goto(`${BASE}/to-nie-istnieje`)
  await page.waitForURL(`${BASE}/`)
  record('H1 unknown route redirects to dashboard', true)
  await page.goto(`${BASE}/sale`)
  await page.waitForTimeout(2500)
  const saleGate = await page.getByText('potrzebne konto').count()
  record('H2 room finder /sale is public', saleGate === 0)
  await context.close()
}

// ── E + F: registrations/events rendering and partial failure (fixtures via network interception) ──
{
  const { context, page } = await newPage({ width: 1440, height: 1100 })
  const now = Date.now()
  const iso = (h) => new Date(now + h * 3600_000).toISOString()
  const registrations = [
    { id: 'r-open', title: 'Rejestracja na przedmioty fakultatywne — Tura 1', description: 'Kod rejestracji USOSweb: WZ.IDM-26/27-fak', audience_label: 'Instytut Dziennikarstwa, Mediów i Komunikacji Społecznej', opens_at: iso(-24), closes_at: iso(30), registration_url: 'https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/rejestracjaTury&x=1', kind: 'obieralne', source_usos_tura_id: 't1', source_unit_code: 'UJ.WZ.IDMiKS', updated_at: iso(-1) },
    { id: 'r-upcoming', title: 'Rejestracja na wykłady monograficzne', description: null, audience_label: 'Instytut Informatyki Analitycznej', opens_at: iso(50), closes_at: iso(24 * 8), registration_url: 'https://www.usosweb.uj.edu.pl/kontroler.php?_action=news/rejestracje/rejestracjaTury&x=2', kind: 'inne', source_usos_tura_id: 't2', source_unit_code: 'UJ.WMI.IIA', updated_at: iso(-1) },
    { id: 'r-closed', title: 'Rejestracja zakończona wczoraj', description: null, audience_label: 'Instytut Historii', opens_at: iso(-200), closes_at: iso(-2), registration_url: 'https://www.usosweb.uj.edu.pl/x', kind: 'inne', source_usos_tura_id: 't3', source_unit_code: 'UJ.WH.IH', updated_at: iso(-30) },
  ]
  const events = [
    { id: 'e1', external_id: 'uj:test-1', title: 'Konferencja testowa (fixture)', date: iso(48), category: 'Oficjalne', location: 'Uniwersytet Jagielloński, Kraków', description: 'Treść z oficjalnego serwisu UJ.', faculty: 'Uniwersytet Jagielloński', source_name: 'Uniwersytet Jagielloński', event_url: 'https://www.uj.edu.pl/kalendarz/-/journal_content/1', image_url: null, scraped_at: iso(-14) },
  ]
  await page.route('**/rest/v1/usos_registrations**', (route) => {
    const url = route.request().url()
    const body = url.includes('select=updated_at') ? [{ updated_at: iso(-1) }] : registrations
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/rest/v1/official_events**', (route) => {
    const url = route.request().url()
    const body = url.includes('select=scraped_at') ? [{ scraped_at: iso(-14) }] : events
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/rest/v1/announcements**', (route) => route.abort('failed'))
  await page.goto(`${BASE}/`)
  await page.getByText('Rejestracja na przedmioty fakultatywne — Tura 1').waitFor({ timeout: 15000 })
  record('E1 open registration rendered', true)
  const closedShown = await page.getByText('Rejestracja zakończona wczoraj').count()
  record('E2 closed registration not presented as active', closedShown === 0)
  const deadline = await page.getByText(/Zamyka się za 1 dzień/).count()
  record('E3 deadline countdown for verified near deadline', deadline >= 1)
  const opening = await page.getByText(/Otwiera się za 2 dni/).count()
  record('E4 upcoming registration shows opening time', opening >= 1)
  const eventRow = await page.getByText('Konferencja testowa (fixture)').count()
  const placeholder = await page.getByText('Uniwersytet Jagielloński, Kraków').count()
  record('E5 event rendered without placeholder location', eventRow === 1 && placeholder === 0)
  await page.getByText(/Nie udało się pobrać: komunikaty/).waitFor({ timeout: 15000 })
  record('F1 failed announcements show an error (not "no announcements") while other sections render', true)
  await page.getByRole('banner').getByRole('button', { name: /Wydział:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Wydział Zarządzania i Komunikacji Społecznej/ }).click()
  await page.getByRole('heading', { name: 'Ważne teraz' }).waitFor({ timeout: 10000 })
  const priority = await page.getByText(/Rejestracja zamyka się za 1 dzień/).count()
  record('E6 "Ważne teraz" escalates the faculty registration closing within 72 h', priority === 1)
  const otherFacultyInList = await page.getByRole('heading', { name: 'Nadchodzące rejestracje' }).locator('xpath=ancestor::section').getByText('Rejestracja na wykłady monograficzne').count()
  record('E7 registrations filtered by faculty (WMI item hidden for WZiKS)', otherFacultyInList === 0)
    await context.close()
}

// ── I: mobile 360 px ──────────────────────────────────────────────────────
{
  const { context, page } = await newPage({ width: 360, height: 760 })
  for (const path of ['/', '/komunikaty', '/rejestracje', '/wydarzenia', '/szukaj?q=lektorat', '/niezbednik', '/moj-plan', '/logowanie']) {
    await page.goto(`${BASE}${path}`)
    await page.waitForTimeout(2500)
    record(`I1 no horizontal overflow at 360px: ${path}`, await noOverflow(page))
  }
  await page.goto(`${BASE}/`)
  await page.locator('article').first().waitFor({ timeout: 15000 })
  const bottomNav = page.getByRole('navigation', { name: 'Pasek nawigacji' })
  record('I2 bottom navigation visible on mobile', await bottomNav.isVisible())
  await bottomNav.getByRole('button', { name: 'Szukaj' }).click()
  await page.waitForURL(`${BASE}/szukaj`)
  const searchFocused = await page
    .waitForFunction(() => document.activeElement?.id === 'info-search-input', null, { timeout: 3000 })
    .then(() => true, () => false)
  record('I3 mobile search tab opens search with focused input', searchFocused)
  await bottomNav.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: /Wydział:/ }).first().click()
  const dialogBox = await page.getByRole('dialog', { name: 'Wybierz wydział' }).boundingBox()
  record('I4 faculty picker usable on mobile (fits viewport)', !!dialogBox && dialogBox.width <= 360, dialogBox ? `${Math.round(dialogBox.width)}px wide` : 'no dialog')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Otwórz menu' }).click()
  const drawer = page.getByRole('dialog', { name: 'Menu nawigacji' })
  await drawer.waitFor()
  record('I5 drawer opens with information items', (await drawer.getByRole('button', { name: 'Komunikaty' }).count()) === 1)
  const socialInDrawer = await drawer.getByRole('button', { name: 'Społeczność' }).count()
  record('I6 anonymous drawer hides account/social items', socialInDrawer === 0)
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
const uniqueErrors = [...new Set(consoleErrors)]
console.log(`console/page errors: ${uniqueErrors.length}`)
for (const e of uniqueErrors.slice(0, 25)) console.log('  ', e)
process.exit(failed.length > 0 ? 1 : 0)
