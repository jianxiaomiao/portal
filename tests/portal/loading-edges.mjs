import assert from 'node:assert/strict'
import http from 'node:http'
import {createReadStream} from 'node:fs'
import {stat,writeFile} from 'node:fs/promises'
import {extname,resolve,sep} from 'node:path'
import {once} from 'node:events'
import {chromium} from 'playwright'

// A chunked response exposes received bytes before the server sends the rest.
const folder=resolve(process.env.PORTAL_CHECK_DIR || 'dist-check')
let finishStream
const continuing=new Promise(resolve=>{finishStream=resolve})
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.json':'application/json'}
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://localhost').pathname
  const file=resolve(folder,'.'+(route.endsWith('/')?route+'index.html':route))
  if(!file.startsWith(folder+sep))throw Error('invalid asset')
  const {size}=await stat(file)
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream')
  if(file.endsWith('.glb')){
    const prefix=256*1024
    for await(const part of createReadStream(file,{end:prefix-1})) res.write(part)
    await continuing
    createReadStream(file,{start:prefix}).pipe(res)
  }else{res.setHeader('Content-Length',size);createReadStream(file).pipe(res)}
 }catch{res.writeHead(404);res.end()}
})
server.listen(0,'127.0.0.1')
await once(server,'listening')
const base='http://127.0.0.1:'+server.address().port+'/'
const browser=await chromium.launch({channel:'chrome',headless:true})
const result={}
try{
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
 await p.goto(base+'?inspect')
 await p.locator('[data-enable]').click()
 await p.waitForFunction(()=>document.querySelector('.loading-card small')?.textContent.includes('0.3 MiB'))
 const progress=await p.locator('.loading-card').evaluate(card=>({bytes:card.querySelector('small').innerText.trim(),hasFraction:card.querySelector('progress').hasAttribute('value')}))
 assert.equal(progress.hasFraction,false)
 result.unknownLength=progress
 finishStream()
 await p.waitForSelector('[data-stage=ready]')
 assert.equal(await p.evaluate(()=>window.__cv.snapshot().bytes),7591900)
 await p.close()
 const c=await browser.newContext()
 const late=await c.newPage()
 await late.addInitScript(()=>{
   const original=window.createImageBitmap.bind(window)
   const close=ImageBitmap.prototype.close
   const bitmaps=new Set()
   window.bitmapProbe={waiting:0,closed:0}
   let resume
   const gate=new Promise(resolve=>{resume=resolve})
   window.releaseImages=resume
   window.createImageBitmap=async (...args)=>{
      const image=await original(...args)
      bitmaps.add(image)
      window.bitmapProbe.waiting++
      await gate
      return image
   }
   ImageBitmap.prototype.close=function(){if(bitmaps.has(this))window.bitmapProbe.closed++;return close.call(this)}
 })
 await late.goto(base+'?inspect')
 await late.locator('[data-enable]').click()
 await late.waitForFunction(()=>window.bitmapProbe.waiting>0)
 await late.getByRole('link',{name:'探索小镇 →',exact:true}).click()
 await late.waitForSelector('[data-route="/explore/"] .cv-root')
 await late.locator('.sitehead .signature').click()
 await late.waitForSelector('[data-route="/"]')
 await late.evaluate(()=>window.releaseImages())
 await late.waitForFunction(()=>window.bitmapProbe.closed>0 && window.bitmapProbe.closed===window.bitmapProbe.waiting)
 result.cancelledDecode=await late.evaluate(()=>({...window.bitmapProbe,canvases:document.querySelectorAll('canvas').length,hasLateOwner:!!window.__cv}))
 assert.equal(result.cancelledDecode.canvases,0)
 assert.equal(result.cancelledDecode.hasLateOwner,false)
 await c.close()
 console.log(JSON.stringify(result))
}finally{
 finishStream()
 await writeFile(new URL('../../reports/integration/loading-edges.json',import.meta.url),JSON.stringify(result,null,2))
 await browser.close()
 server.closeAllConnections()
 server.close()
}
