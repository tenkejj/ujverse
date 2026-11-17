/** Playwright CLI function. Synthetic SSE only: scripts/polish-stream-server.mjs. */
async page => {
  const results = []
  try {
  const assert = (condition, message) => { if (!condition) throw Error(message) }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  for (const [version, base] of [['before','http://127.0.0.1:4184'],['after','http://127.0.0.1:4183']]) {
    await page.setViewportSize({ width:1440, height:900 })
    for (const scenario of ['short','fast','characters','irregular','slow']) {
      await page.goto(base + '/chat')
      const input = page.getByRole('textbox', { name:'Wiadomość do Versusia' })
      await input.waitFor()
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('main > div')).opacity==='1')
      await input.fill('test:' + scenario)
      await page.evaluate(() => {
        const m = window.streamMetrics = { start:performance.now(), first:0, updates:0, maxBurst:0, textLength:0, done:0, longTasks:0, longTaskMs:0 }
        window.streamLongTasks = new PerformanceObserver(l=>{for(const e of l.getEntries()){m.longTasks++;m.longTaskMs+=e.duration}})
        window.streamLongTasks.observe({type:'longtask'})
        window.streamObserver = new MutationObserver(()=>{
          const el = document.querySelector('.chat-stream')
          if(!el)return
          if(el.getAttribute('aria-busy')==='false')m.done ||= performance.now()
          const text = [...el.children].filter(e=>!e.matches('.chat-stream-status,.chat-stream-footer')).map(e=>e.textContent).join('')
          if(text.length===m.textLength)return
          m.first ||= performance.now()
          m.updates++
          m.maxBurst = Math.max(m.maxBurst, text.length-m.textLength)
          m.textLength=text.length
        })
        window.streamObserver.observe(document.querySelector('.versus-conversation'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-busy']})
      })
      const getCost = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(m=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].includes(m.name)).map(m=>[m.name,m.value]))
      const before=await getCost()
      await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
      await page.locator('.chat-stream').waitFor()
      await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).waitFor({state:'hidden',timeout:30000})
      const metrics=await page.evaluate(()=>{
        window.streamObserver.disconnect();window.streamLongTasks.disconnect()
        const m=window.streamMetrics, end=performance.now()
        const resource=performance.getEntriesByType('resource').filter(e=>e.name.endsWith('/api/chat')).at(-1)
        return {...m,firstMs:m.first-m.start,totalMs:(m.done||end)-m.start,tailMs:resource?(m.done||end)-resource.responseEnd:null}
      })
      const after=await getCost()
      const cost=Object.fromEntries(Object.keys(before).map(k=>[k,Math.round((after[k]-before[k])*1000)]))
      const text=await page.locator('.chat-stream').innerText()
      assert(text.includes(scenario==='short'?'Krótka odpowiedź':'Versuś pomaga'),version+' '+scenario+' missing content')
      if(scenario==='fast'||scenario==='irregular') {
        assert(await page.locator('.chat-stream h3').count()>0,'heading')
        assert(await page.locator('.chat-stream li').count()===3,'nested list')
        assert(await page.locator('.chat-stream pre').count()===1,'code fence')
        assert(await page.locator('.chat-stream a[href="https://uj.edu.pl"]').count()===1,'link')
      }
      results.push({version,scenario,...metrics,cost})
      if(version==='after' && scenario==='irregular') await page.screenshot({path:'docs/polish/screenshots/stream-complete.png'})
    }
  }
  for(const after of results.filter(r=>r.version==='after')) assert(after.textLength===results.find(r=>r.version==='before'&&r.scenario===after.scenario).textLength,'stream lost content');
  // Actual DOM behaviour: cancellation freezes partial content; retry replaces the last turn.
  await page.goto('http://127.0.0.1:4183/chat')
  const input=page.getByRole('textbox',{name:'Wiadomość do Versusia'})
  await input.fill('test:slow');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.locator('.chat-stream p').first().waitFor()
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).click()
  const cancelled=await page.locator('.chat-stream').innerText()
  await page.evaluate(()=>new Promise(r=>setTimeout(r,250)))
  assert(await page.locator('.chat-stream').innerText()===cancelled,'content changed after cancel')
  await input.fill('test:short');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).waitFor({state:'hidden'})
  const count=await page.locator('.chat-stream').count()
  await page.getByRole('button',{name:'Wygeneruj odpowiedź ponownie',exact:true}).last().click()
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).waitFor({state:'hidden'})
  assert(await page.locator('.chat-stream').count()===count,'retry duplicated history')
  // Grow a conversation, scroll away, and ensure later incoming content cannot pull it down.
  await input.fill('test:fast');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).waitFor({state:'hidden'})
  await input.fill('test:slow');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.locator('.chat-stream').last().locator('p').first().waitFor()
  await page.locator('.versus-conversation-scroll').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'))})
  await page.evaluate(()=>new Promise(r=>setTimeout(r,600)))
  assert(await page.locator('.versus-conversation-scroll').evaluate(el=>el.scrollTop)<10,'auto-scroll stole position')
  await page.screenshot({path:'docs/polish/screenshots/stream-reading-history.png'})
  await page.locator('.versus-conversation-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'))})
  await page.evaluate(()=>new Promise(r=>setTimeout(r,400)))
  assert(await page.locator('.versus-conversation-scroll').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)<50,'auto-scroll failed near bottom')
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).click()
  // Reduced motion preference can change while streaming; no cosmetic completion wait.
  await page.emulateMedia({reducedMotion:'reduce'})
  await input.fill('test:short');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.getByRole('button',{name:'Zatrzymaj odpowiedź',exact:true}).waitFor({state:'hidden'})
  assert((await page.locator('.chat-stream').last().innerText()).includes('Krótka odpowiedź'),'reduced motion')
  await input.fill('test:error');await page.getByRole('button',{name:'Wyślij wiadomość',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'Nie udało się uzyskać odpowiedzi'}).waitFor()
  return {results,cancel:true,retry:true,scrollAway:true,scrollBottom:true,reducedMotion:true,error:true,provider:'synthetic local SSE; no live AI call'}
  } catch(error) { return {results,error:String(error)} }
}
