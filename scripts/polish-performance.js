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

 await page.emulateMedia({reducedMotion:"reduce"});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  if(window.ujPolishMetrics)return;
  const metrics=window.ujPolishMetrics={lcp:0,cls:0,lcpElement:'',shifts:[]};
  new PerformanceObserver(l=>{const e=l.getEntries().at(-1);metrics.lcp=e.startTime;metrics.lcpElement=e.element?.tagName+' '+e.element?.className+' '+e.element?.textContent?.slice(0,80)}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){metrics.cls+=e.value;metrics.shifts.push({value:e.value,sources:e.sources?.map(s=>({tag:s.node?.tagName,cls:s.node?.className,previous:s.previousRect,current:s.currentRect}))})}}).observe({type:'layout-shift',buffered:true});
 });
 const rows=[];
 for(let i=0;i<3;i++)for(const width of [390,1920])for(const [phase,base] of [["before","http://127.0.0.1:4274"],["after","http://127.0.0.1:4273"]]){
  await page.setViewportSize({width,height:width===390?844:1080});
  await page.goto(base+'/');
  await page.locator('#versus-question').waitFor();
  await page.evaluate(()=>new Promise(r=>setTimeout(r,6000)));
  rows.push({phase,...await page.evaluate(()=>({...window.ujPolishMetrics,width:innerWidth,jsBytes:performance.getEntriesByType('resource').filter(e=>/\.js(?:\?|$)/.test(e.name)).reduce((s,e)=>s+e.encodedBodySize,0),jsDecoded:performance.getEntriesByType('resource').filter(e=>/\.js(?:\?|$)/.test(e.name)).reduce((s,e)=>s+e.decodedBodySize,0),dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd}))});
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 return rows;
}
