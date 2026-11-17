async page => {
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

await page.context().route('**/rest/v1/**', async route => {
const url = new URL(route.request().url());
let data = url.pathname.endsWith('/announcements') ? announcements : url.pathname.endsWith('/usos_registrations') ? registrations : url.pathname.endsWith('/official_events') ? events : [];
if (url.searchParams.get('select') === 'full_body') data = {full_body: 'Pełna treść do testów. '.repeat(80)};
await route.fulfill({status:200,json:data});
});
await page.emulateMedia({reducedMotion:'reduce'});
await page.context().addInitScript(()=>{
  if(!document.startViewTransition)return;
  const start=document.startViewTransition.bind(document);
  document.startViewTransition=(...args)=>{
    const transition=start(...args);
    window.polishThemeDone=transition.finished.catch(()=>{});
    return transition;
  };
});
const results=[];
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
for(const route of ['/', '/wydarzenia', '/rejestracje','/komunikaty','/niezbednik','/szukaj','/poradniki']) {
await page.goto('http://127.0.0.1:4273'+route);
await page.locator('main h1').waitFor();
await page.waitForFunction(()=>getComputedStyle(document.querySelector('main > div')).opacity==='1');
if(route==='/komunikaty')await page.locator('main .info-entry').first().waitFor();
if(route==='/rejestracje')await page.locator('.deadline-entry').first().waitFor();
for(const width of [390,768,1440,1920,2560]) {
await page.setViewportSize({width,height:width===390?844:1080});
await page.evaluate(()=>new Promise(r=>setTimeout(r,250)));
for(const theme of ['light','uj','dark']) {
for(let cycle=0;cycle<3;cycle++) {
const active=await page.evaluate(()=>localStorage.getItem('uj-theme'));
if(active===theme)break;
await page.locator('.uj-header-bar button[aria-label^="Motyw:"]:visible').click();
await page.evaluate(()=>window.polishThemeDone);
}
await page.evaluate(()=>scrollTo(0,0));
await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
if(geometry.scrollWidth>width)throw Error('Overflow '+route+' '+width+' '+theme);
await page.screenshot({path:'docs/polish/screenshots/after-'+(route.slice(1)||'home')+'-'+theme+'-'+width+'.png'});
results.push({route,theme,...geometry});
}
}
}
return {cases:results.length,errors,results};
}