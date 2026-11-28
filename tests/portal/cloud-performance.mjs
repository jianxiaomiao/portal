import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
import {openChapter,button,next} from '../phase8/support-chat-ui.mjs'
const out = new URL('../../reports/cloud-realm-final/performance.json', import.meta.url), rows=[]
const [baseline, candidate] = process.argv.slice(2)
if (!baseline || !candidate) throw Error('Pass baseline and candidate inspection origins.')
const browser=await chromium.launch({channel:'chrome'})
try{
for(const [round,version] of ['A','B','B','A'].entries()){
 const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 await p.addInitScript(()=>{
  const native=requestAnimationFrame.bind(window)
  window.requestAnimationFrame=cb=>native(ts=>{
   const m=window.frameMeter
   if(!m||m.seen++%3)return cb(ts)
   const frame=m.r.info.render.frame, q=m.gl.createQuery()
   m.gl.beginQuery(m.ext.TIME_ELAPSED_EXT,q)
   try{cb(ts)}finally{m.gl.endQuery(m.ext.TIME_ELAPSED_EXT);if(frame!==m.r.info.render.frame)m.queries.push(q);else m.gl.deleteQuery(q)}
  })
 })
 const root = new URL('/', version==='A'?baseline:candidate).href
 await p.goto(root+'?inspect')
 await p.locator('[data-enable]').click()
 await p.waitForFunction(()=>window.__cv?.snapshot().fps>0)
 async function measure(view,theme,quality){
  await p.waitForTimeout(600)
  const s=await p.evaluate(async()=>{
   const t=window.__cv.owner(), r=t.renderer,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2')
   const m={r,gl,ext,seen:0,queries:[]}
   if(ext)window.frameMeter=m
   const sample=await t.stats.sample(1650)
   window.frameMeter=null
   await new Promise(ok=>setTimeout(ok,120))
   const disjoint=ext?gl.getParameter(ext.GPU_DISJOINT_EXT):true
   const ms=[]
   for(const q of m.queries){if(!disjoint&&gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))ms.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q)}
   ms.sort((a,b)=>a-b)
   const fields=['fps','p95FrameMs','callsRange','trianglesRange','buffer','textures','geometries','shadowPeakCalls','downloadMs','parseMs','cloudInitMs','firstRenderMs','readyMs','gpu','frames']
   const cloud=t.clouds,targets=cloud.mist?[cloud.opaque,cloud.mist].map(v=>[v.width,v.height,v.texture.type]):null
   const bytes=geo=>Object.values(geo.attributes).reduce((sum,a)=>sum+a.array.byteLength,geo.index?.array.byteLength??0)
   const budget=targets?{
    densityBytes:cloud.state.forms.reduce((sum,f)=>sum+f.volume.image.data.byteLength,0),
    formMeshBytes:cloud.state.forms.reduce((sum,f)=>sum+bytes(f.skin)+bytes(f.low),0),
    deckMeshBytes:bytes(cloud.sea.deck.geometry),
    reliefBaseBytes:cloud.sea.uniforms.relief.value.image.data.byteLength,
    shoreBytes:cloud.sea.uniforms.coast.value.image.data.byteLength,
    targetBytes:targets.reduce((sum,[w,h,type],i)=>sum+w*h*((type===1016?8:4)+(i===0?4:0)),0),
    volumeMeshes:cloud.gas.children.length, allBanks:cloud.linked.length
   }:null
   return {...Object.fromEntries(fields.map(k=>[k,sample[k]])),budget,disjoint,gpuSamples:ms.length,gpuP50:ms[Math.ceil(ms.length*.5)-1],gpuP95:ms[Math.ceil(ms.length*.95)-1],targets,level:cloud.level}
  })
  rows.push({round,version,view,theme,quality,...s})
  writeFileSync(out,JSON.stringify({browser:browser.version(),rows},null,2))
 }
 await measure('homepage','day','auto')
 const start=Date.now()
 await p.getByRole('link',{name:'探索小镇 →',exact:true}).click()
 await p.waitForSelector('[data-route="/explore/"] .cv-root .app:not(.compact)')
 rows.at(-1).previewToExploreMs=Date.now()-start
 const pose=async(which)=>p.evaluate(which=>{
   const t=window.__cv.owner(),r=t.rig
   t.select(null);r.go(which==='building'?'NX':'home');r.update(performance.now()+5000)
   if(which!=='building'){r.width=72;r.height=45;r.resize(t.canvas.clientWidth,t.canvas.clientHeight);r.zoom((which==='wide'?.12:which==='cloud'?1.8:1)/r.camera.zoom)}
   if(which==='cloud'){const focus=r.controls.target.clone().set(-29,2,10);r.camera.position.add(focus.clone().sub(r.controls.target));r.controls.target.copy(focus);r.controls.update()}
 },which)
 for(const theme of ['day','night']){
   await p.evaluate(theme=>window.__cv.owner().setTheme(theme),theme)
   for(const quality of ['high','auto','low']){
    await p.evaluate(q=>window.__cv.owner().setQuality(q),quality)
    await pose('home')
    await measure('home',theme,quality)
   }
   await p.evaluate(()=>window.__cv.owner().setQuality('auto'))
   for(const key of ['building','cloud','wide']){await pose(key);await measure(key,theme,'auto')}
 }
 await pose('home')
 await p.evaluate(()=>window.__cv.owner().setTheme('day'))
 for(const key of ['api','journey','chat']){
   await openChapter(p,key,'normal');await next(p)
   await measure(key,'day','auto');await button(p,'取消演示').click()
 }
 await p.close()
 console.log('finished',round,version)
}
}finally{await browser.close()}
