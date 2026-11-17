/** Local synthetic SSE provider + static previews. Never calls an AI or writes user data.
 * node scripts/polish-stream-server.mjs [baseline-dist]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' }
const paragraph = 'Versuś pomaga znaleźć publiczne informacje UJ. Sprawdź aktualne zasady w oficjalnym źródle. '
export const markdown = '# Informacje dla studentów\n\n' + paragraph.repeat(3) + '\n\n## Przygotuj dokumenty\n\n- Wniosek\n- Potwierdzenie\n  - Załącznik\n\n[Oficjalne źródło UJ](https://uj.edu.pl)\n\n```ts\nconst uczelnia = "UJ"\n\nconsole.log(uczelnia)\n```\n\n' + Array.from({length:18},(_,i)=>`### Krok ${i+1}\n\n${paragraph.repeat(4)}\n\n`).join('')
function serve(root, port) {
 root = resolve(root)
 createServer(async (req,res)=>{
  if(req.url==='/api/chat' && req.method==='POST') {
   let body=''; for await(const chunk of req)body+=chunk
   const prompt=JSON.parse(body).messages.at(-1).content
   const scenario=prompt.replace('test:','')
   if(scenario==='error') { res.writeHead(503,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Testowy błąd dostawcy'})); return }
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'})
   res.flushHeaders()
   const content=scenario==='short'?'Krótka odpowiedź. [UJ](https://uj.edu.pl)':scenario==='characters'?paragraph.repeat(5):markdown
   const chunks=[]; let offset=0, i=0
   while(offset<content.length){const size=scenario==='characters'?1:scenario==='fast'?600:scenario==='slow'?60:[1,24,400,8,120][i%5];chunks.push(content.slice(offset,offset+size));offset+=size;i++}
   let index=0, closed=false, timer
   req.on('close',()=>{closed=true;clearTimeout(timer)})
   const write=()=>{
    if(closed)return
    const chunk=chunks[index++]
    if(chunk===undefined){res.end('data: [DONE]\n\n');return}
    res.write('data: '+JSON.stringify({choices:[{delta:{content:chunk}}]})+'\n\n')
    const delay=scenario==='fast'||scenario==='short'?0:scenario==='characters'?1:scenario==='slow'?70:[5,10,90,15,150][index%5]
    timer=setTimeout(write,delay)
   }
   timer=setTimeout(write,30)
   return
  }
  try {
   let name=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))
   if(name!==root && !name.startsWith(root+sep)) {res.writeHead(403);res.end();return}
   if(!extname(name))name=resolve(root,'index.html')
   const bytes=await readFile(name)
   res.writeHead(200,{'Content-Type':mime[extname(name)]??'application/octet-stream'});res.end(bytes)
  } catch {res.writeHead(404);res.end()}
 }).listen(port,'127.0.0.1',()=>console.log(`Synthetic SSE preview: http://127.0.0.1:${port}`))
}
serve('dist',4183)
if(process.argv[2])serve(process.argv[2],4184)
