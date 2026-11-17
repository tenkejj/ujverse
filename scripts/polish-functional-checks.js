async page => {
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const check=(condition,message)=>{if(!condition)throw Error(message)};
const base='http://127.0.0.1:4273';
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

let mode='ready';
await page.context().route('**/rest/v1/**', async route => {
if(mode==='error')return route.fulfill({status:503,json:{message:'Testowy błąd źródła'}});
const url = new URL(route.request().url());
let data = mode==='empty' ? [] : url.pathname.endsWith('/announcements') ? announcements : url.pathname.endsWith('/usos_registrations') ? registrations : url.pathname.endsWith('/official_events') ? events : [];
if (url.searchParams.get('select') === 'full_body') data = {full_body: 'Pełna treść do testów. '.repeat(80)};
await route.fulfill({status:200,json:data});
});

await page.emulateMedia({reducedMotion:'reduce'});
await page.setViewportSize({width:1920,height:1080});
await page.goto(base+'/');
await page.getByRole('button',{name:'Jak dostać stypendium rektora?',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#versus-question').value==='Jak dostać stypendium rektora?');
await settle();
check(await page.locator('#versus-question').evaluate(el=>el===document.activeElement),'composer focus');
await page.getByText('Więcej pytań',{exact:true}).click();
const panel=page.locator('.versus-questions-panel');
await panel.getByRole('button').last().focus();await page.keyboard.press('Escape');
await settle();
check(!await page.locator('.versus-questions-more').evaluate(el=>el.open),'Escape disclosure');
await page.getByText('Więcej pytań',{exact:true}).press('Enter');
await panel.getByRole('button').last().click();
await settle();
check((await page.locator('#versus-question').inputValue()).includes('psychologiczne'),'more suggestion');
await settle();
check(!await page.locator('.versus-questions-more').evaluate(el=>el.open),'selection close');
await page.getByText('Więcej pytań',{exact:true}).click();
await page.screenshot({path:'docs/polish/screenshots/questions-desktop.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'docs/polish/screenshots/questions-mobile.png'});
await settle();
check((await panel.boundingBox()).width<=350,'questions overflow');
// Sending follows the existing one-shot handoff. Network is deliberately stubbed here.
let sends=0;
await page.route('**/api/chat',async route=>{sends++;await route.fulfill({status:200,contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Odpowiedź testowa."}}]}\n\ndata: [DONE]\n\n'})});
await page.getByText('Więcej pytań',{exact:true}).click();
await page.getByRole('button',{name:'Wyślij wiadomość do Versusia',exact:true}).click();
await page.locator('.chat-stream').waitFor();
await settle();
check(sends===1,'duplicate handoff');
await page.unroute('**/api/chat');
await page.setViewportSize({width:1920,height:1080});
await page.goto(base+'/komunikaty');
await page.locator('main .info-entry').first().waitFor();
await settle();
check(await page.locator('main .info-entry').count()===20,'initial count');
await page.getByRole('link',{name:'Załaduj więcej komunikatów'}).click();
await settle();
check(await page.locator('main .info-entry').count()===40,'load more');
const article=page.locator('main .info-entry').first();
const source=article.locator('.info-entry-content > a');
const before=await source.boundingBox();
const articleBefore=await article.boundingBox();
await article.getByRole('button',{name:'Czytaj treść',exact:true}).click();
await article.locator('.announcement-body').waitFor();
const after=await source.boundingBox();const articleAfter=await article.boundingBox();check(Math.abs((after.y-articleAfter.y)-(before.y-articleBefore.y))<1,'source action shifted on expansion');
await settle();
check(await article.getByRole('button',{name:'Zwiń treść',exact:true}).getAttribute('aria-expanded')==='true','expanded');
await page.screenshot({path:'docs/polish/screenshots/announcement-expanded.png'});
await page.getByRole('searchbox',{name:'Szukaj w komunikatach'}).fill('zzzznieistniejący');
await page.getByText('Żaden komunikat nie pasuje').waitFor();
await page.goto(base+'/wydarzenia');
await page.locator('.info-calendar-days button').first().waitFor();
const selected=page.locator('.info-calendar-days button[aria-pressed=true]');
const initial=await selected.getAttribute('aria-label');await selected.press('ArrowRight');
await settle();
check(await selected.getAttribute('aria-label')!==initial,'calendar keyboard');
await page.getByRole('button',{name:'Dziś',exact:true}).click();
await settle();
check(await page.locator('.info-calendar-days button[aria-current=date]').getAttribute('aria-pressed')==='true','today');
await page.getByRole('button',{name:'Najbliższe wydarzenie',exact:true}).click();
await page.setViewportSize({width:1024,height:480});
let footer=await page.locator('.sidebar-controls').boundingBox();check(footer.y+footer.height<=480,'short sidebar footer');
await page.getByRole('button',{name:'Zwiń nawigację',exact:true}).click();
await settle();
check((await page.locator('.app-sidebar').boundingBox()).width===72,'collapsed sidebar');
await page.getByRole('button',{name:'Rozwiń nawigację',exact:true}).click();
await page.screenshot({path:'docs/polish/screenshots/sidebar-short.png'});
// Search and status filters retain the exact source URLs and all course titles.
await page.setViewportSize({width:1920,height:1080});
await page.goto(base+'/rejestracje');
await page.locator('.deadline-entry').first().waitFor();
const cards=page.locator('.deadline-entry');
await settle();
check(await cards.count()===8,'registration count');
const row=await cards.first().boundingBox(), beside=await cards.nth(1).boundingBox();
await settle();
check(Math.abs(row.y-beside.y)<1 && Math.abs(row.height-beside.height)<1,'card rows');
await page.getByRole('button',{name:/Nadchodzące/}).click();
await settle();
check(await cards.count()>0 && await cards.count()<8,'registration phase');
await page.getByRole('searchbox',{name:'Szukaj rejestracji'}).fill('zzzznieistniejący');
await settle();
check(await cards.count()===0,'registration search');
await page.goto(base+'/niezbednik');
await page.getByRole('searchbox',{name:'Szukaj w niezbędniku'}).fill('USOS');
await settle();
const tools=await page.locator('.campus-resource-grid .resource-entry').allTextContents();
check(tools.length>=2 && tools.length<10 && tools.every(t=>/usos/i.test(t)),'tool search');
// Additional edge data: mixed title lengths, a closed registration, several events on one day.
await page.context().unroute('**/rest/v1/**');
registrations[0].closes_at=new Date(Date.now()-86400000).toISOString();
registrations[1].title='Krótki tytuł';
registrations[2].title='Długa nazwa przedmiotu i rejestracji '.repeat(14);
for(const event of events.slice(0,4))event.date=events[0].date;
await page.context().route('**/rest/v1/**', async route=>{
const url=new URL(route.request().url());
if(mode==='error')return route.fulfill({status:503,json:{message:'Testowy błąd źródła'}});
const data=mode==='empty'?[]:url.pathname.endsWith('/usos_registrations')?registrations:url.pathname.endsWith('/official_events')?events:announcements;
await route.fulfill({json:data});
});
await page.goto(base+'/rejestracje');await page.locator('.deadline-entry').first().waitFor();
await page.getByRole('button',{name:/Zakończone/}).click();
await page.locator('.deadline-entry[data-tone="closed"]').waitFor();
await page.goto(base+'/rejestracje');await page.locator('.deadline-entry').first().waitFor();
await settle();
check((await page.locator('.deadline-entry').allTextContents()).join('').includes(registrations[2].title.trim()),'long title hidden');
await page.screenshot({path:'docs/polish/screenshots/registrations-mixed-titles.png'});
await page.goto(base+'/wydarzenia');await page.locator('.info-calendar-days button').first().waitFor();
await settle();
check(await page.locator('.info-calendar-agenda .event-preview').count()===4,'multiple-event agenda');
await page.screenshot({path:'docs/polish/screenshots/calendar-many-events.png'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'docs/polish/screenshots/calendar-many-events-mobile.png',fullPage:true});
for(const state of ['empty','error']) {
mode=state;
for(const route of ['/komunikaty','/rejestracje','/wydarzenia']) {
await page.goto(base+route);
await page.getByText(state==='error'?'Nie udało się':route==='/komunikaty'?'Brak nowych komunikatów':route==='/rejestracje'?'Brak':'Brak').first().waitFor();
await settle();
check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'edge overflow');
}
}
return {suggestions:true,keyboard:true,escape:true,handoff:true,loadMore:true,stableDisclosure:true,calendar:true,sidebar:true,registrationFilters:true,toolsSearch:true,mixedTitles:true,multipleEvents:true,emptyAndError:true};
}