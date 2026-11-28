import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {base,chromeOptions,desktop,ready,settle,snap,json} from './common.mjs'
const browser=await chromium.launch(chromeOptions)
const result={cycles:[],passed:false}
try {
  const p=await browser.newPage(desktop)
  await p.addInitScript(()=>{
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener
    const tracked=[],useCapture=o=>typeof o==='boolean'?o:!!o?.capture
    const watch=t=>t===document||t===window||t instanceof HTMLCanvasElement
    EventTarget.prototype.addEventListener=function(type,fn,opts){
      if(watch(this)&&fn&&!opts?.once&&!tracked.some(e=>e.t===this&&e.type===type&&e.fn===fn&&e.capture===useCapture(opts))){
        tracked.push({t:this,type,fn,capture:useCapture(opts),signal:opts?.signal})
      }
      return add.call(this,type,fn,opts)
    }
    EventTarget.prototype.removeEventListener=function(type,fn,opts){
      const i=tracked.findIndex(e=>e.t===this&&e.type===type&&e.fn===fn&&e.capture===useCapture(opts))
      if(i>=0)tracked.splice(i,1)
      return remove.call(this,type,fn,opts)
    }
    const request=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set()
    window.requestAnimationFrame=fn=>{
      const id=request(t=>{pending.delete(id);fn(t)});pending.add(id);return id
    }
    window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id)}
    window.__lifetime=()=>({
      pending:pending.size,
      canvas:tracked.filter(e=>e.t instanceof HTMLCanvasElement&&e.t.isConnected&&!e.signal?.aborted).length,
      previousCanvas:tracked.filter(e=>e.t instanceof HTMLCanvasElement&&!e.t.isConnected&&!e.signal?.aborted).length,
      global:tracked.filter(e=>(e.t===document||e.t===window)&&!e.signal?.aborted).length
    })
  })
  let release,started
  const gate=new Promise(ok=>release=ok),intercepted=new Promise(ok=>started=ok)
  await p.route('**/Town.glb',async route=>{started();await gate;await route.continue()})
  await p.goto(base+'?inspect&model=raw',{waitUntil:'domcontentloaded'});await Promise.race([intercepted, p.waitForTimeout(30000).then(()=>{throw Error('未观察到普通模型请求')})])
  await p.locator('[data-place=FO]').click()
  assert.ok(await p.getByRole('link',{name:/查看 GitHub/}).isVisible())
  release();await ready(p);await settle(p)
  assert.equal((await snap(p)).selected,'FO');assert.equal((await snap(p)).entering,false)
  await p.unroute('**/Town.glb')
  await p.keyboard.press('Escape');await settle(p)
  const first=await p.evaluate(()=>window.__lifetime())
  for(let i=0;i<3;i++){
    await p.getByLabel('切换昼夜').click()
    await p.evaluate(()=>window.__cv.restart());await ready(p);await settle(p)
    const s=await p.evaluate(()=>window.__lifetime())
    assert.equal(s.previousCanvas,0,JSON.stringify(s));assert.equal(s.canvas,first.canvas)
    assert.equal(s.global,first.global);assert.equal(s.pending,first.pending);result.cycles.push(s)
  }
  await p.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await p.getByText('图形上下文已中断，可重新加载场景。').waitFor()
  await p.waitForTimeout(300)
  const released=await p.evaluate(()=>window.__lifetime())
  assert.equal(released.pending,0);assert.equal(released.canvas,0)
  result.before=first;result.released=released
  await p.close();result.passed=true
} finally {await json('phase8-entry.json',result);await browser.close()}
