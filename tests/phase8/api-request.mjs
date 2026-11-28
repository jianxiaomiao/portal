import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chromium, devices } from 'playwright'
import { base, desktop, chromeOptions, start, settle, snap, json, capture } from './common.mjs'

const browser = await chromium.launch(chromeOptions)
const checks = { browser: browser.version(), branches:[], samples:[], cycles:[], checks:[], unexpectedRequests:[], pageErrors:[] }
const btn = (p,name) => p.getByRole('button',{name,exact:true})
const state = async p => (await snap(p)).api
const next = async p => { await btn(p,'下一步').click(); return state(p) }
const exit = async p => { await p.keyboard.press('Escape'); await settle(p) }
const observe = p => {
  p.on('pageerror',e=>checks.pageErrors.push(e.message))
  p.on('request',r=>{
    const url = new URL(r.url())
    if (url.origin !== new URL(base).origin || url.pathname.startsWith('/v1/')) checks.unexpectedRequests.push(r.url())
  })
}
async function enter(p,outcome,{auto=false,wait=false,timeout=false,fail=false}={}) {
  await p.locator('[data-place="hub"]').click()
  await btn(p,'API 请求').click()
  await p.getByLabel('请求结果').selectOption(outcome)
  if(outcome === 'rate') await p.getByLabel('排队后超时',{exact:false}).setChecked(timeout)
  else {
    await p.getByLabel('等待后获得许可').setChecked(wait)
    await p.getByLabel('模拟用量写入失败').setChecked(fail)
  }
  await btn(p,auto?'自动播放':'分步播放').click()
}
async function ticket(p) {
  await p.locator('[data-place="hub"]').click()
  await btn(p,'可靠工单投递').click()
  await p.getByLabel('选择剧情').selectOption('normal')
  await btn(p,'分步播放').click()
  assert.deepEqual((await snap(p)).motion.owners.sort(),['mechanics','vehicle'])
}
const resources = async p => p.evaluate(()=>{
  const cv=window.__cv,s=cv.snapshot()
  return {geometries:s.geometries,materials:cv.materialCount(),textures:s.textures,models:s.modelCount,
    glb:performance.getEntriesByType('resource').filter(r=>/\/Town(?:\.meshopt)?\.glb$/.test(new URL(r.name).pathname)).length}
})
const leds = p => p.evaluate(()=>[1,2,3].map(i=>{
  let value
  window.__cv.inspectObject('NX.Device.Rack'+i).traverse(o=>{if(o.material?.name==='MAT.led')value=[o.material.uuid,o.material.emissiveIntensity]})
  return value
}))
const movement = p => p.evaluate(()=>{
  const cv=window.__cv
  const nc=cv.motion().tracks.buildings
  return [cv.inspectObject('ENV.Control.OrbitTeal').quaternion.toArray(),cv.inspectObject('NX.Array.Dish').quaternion.toArray(),nc.display.material.opacity]
})
async function sample(p,name){
  const {frameIntervalsMs,...m}=await p.evaluate(()=>window.__cv.sample(3000))
  checks.samples.push({name,...m,...await resources(p)})
}
async function branch(p,outcome,opts={},screen=true) {
  await enter(p,outcome,opts)
  const trace=[]
  let s=await state(p)
  while(!s.finished){
    trace.push({step:s.step,used:s.used,http:s.status,usage:s.usage,eventId:s.eventId})
    assert.deepEqual((await snap(p)).motion.owners,[])
    if(s.step==='period')assert.equal(s.used,outcome==='quota'?8:7)
    if(s.step==='commit')assert.equal(s.used,8)
    if(s.step==='response')assert.equal(s.eventId,'')
    if(screen && s.step===({success:'hash',quota:'exhausted',invalid:'invalid',rate:'rateFull'})[outcome]){
      await settle(p);await capture(p,'api-'+outcome)
    }
    if(s.step==='response' && outcome==='success' && screen){
      await p.locator('.api-panel details[open] pre').last().scrollIntoViewIfNeeded()
      await settle(p);await capture(p,'api-response')
    }
    s=await next(p)
  }
  const steps=trace.map(x=>x.step)
  assert.equal(s.status,{success:200,quota:429,invalid:400,rate:429}[outcome])
  assert.equal(s.stopAt,{success:'',quota:'MySQL · 配额短事务',invalid:'MVC · Bean Validation',rate:'限流过滤器 · MVC 之前'}[outcome])
  assert.equal(s.used,outcome==='success'||outcome==='quota'?8:7)
  assert.equal(steps.includes('pre'),outcome!=='rate')
  assert.equal(steps.includes('hash'),outcome==='success')
  assert.equal(steps.includes('locks'),outcome==='success'||outcome==='quota')
  assert.equal(steps.includes('wait'),!!opts.timeout||!!opts.wait)
  if(outcome==='success')assert.equal(s.body.data.hashContent,createHash('sha256').update('hello').digest('hex'))
  if(outcome==='invalid')assert.equal(s.body.data.algorithm,'算法为空')
  if(outcome==='rate'){
    assert.equal(s.eventId,'');assert.equal(s.usage,'尚未创建事件')
    assert.equal(s.body.code,opts.timeout?'APPLICATION_RATE_WAIT_TIMEOUT':'APPLICATION_RATE_QUEUE_FULL')
  } else {
    assert.match(s.eventId,/^[a-f0-9-]{36}$/)
    assert.deepEqual(trace.slice(-5).map(t=>t.usage),['尚未创建事件','已创建 eventId','提交后台任务','已入队',opts.fail?'写入失败':'已持久化'])
    assert.ok(trace.slice(steps.indexOf('response')).every(t=>t.http===s.status))
  }
  assert.equal((await snap(p)).view,'home')
  checks.branches.push({outcome,opts,trace,result:s.body})
  await exit(p)
  console.log('PASS',outcome,opts)
}
try {
  const ctx=await browser.newContext(desktop),p=await ctx.newPage();observe(p);await start(p)
  const baseline=await resources(p)
  assert.equal(baseline.glb,1)
  await sample(p,'小镇总览 · 待机')
  await p.locator('[data-place="NX"]').click();await settle(p);await sample(p,'Nexus 原建筑视角 · 待机');await exit(p)
  await enter(p,'success',{auto:true});await p.waitForFunction(()=>window.__cv.snapshot().api?.step==='header')
  await sample(p,'API 自动播放 · 前窗')
  await btn(p,'暂停剧情').click()
  const frozen=await state(p);await p.waitForTimeout(450);assert.equal((await state(p)).fraction,frozen.fraction)
  await btn(p,'继续播放').click();await p.waitForFunction(f=>window.__cv.snapshot().api.fraction!==f,frozen.fraction)
  await next(p);assert.equal((await state(p)).playing,false)
  for(let i=0;i<3;i++)await btn(p,'从头重播').click()
  assert.equal((await state(p)).step,'send')
  await btn(p,'取消演示').click();await settle(p)
  assert.deepEqual(await resources(p),baseline)
  checks.checks.push('暂停、继续、分步、三次重播、取消后资源一致')
  for(const [outcome,opts,screen] of [['success',{},true],['rate',{},true],['quota',{},true],['invalid',{},true],['rate',{timeout:true},false],['success',{wait:true,fail:true},false]])await branch(p,outcome,opts,screen)
  await btn(p,'暂停动画').click()
  const before=await leds(p)
  await enter(p,'success')
  while((await state(p)).step!=='hash')await next(p)
  const working=await leds(p)
  assert.ok(working[0][1]>before[0][1]);assert.equal(working[0][0],before[0][0]);assert.deepEqual(working.slice(1),before.slice(1))
  await exit(p);assert.deepEqual(await leds(p),before)
  checks.checks.push('仅 Rack1 局部材质提亮，取消后引用和强度逐项恢复')
  await btn(p,'开启动画').click()
  for(let i=0;i<10;i++){
    await enter(p,'success');await next(p)
    if(i===0){
      const a=await movement(p);await p.waitForTimeout(380);const b=await movement(p)
      a.forEach((v,k)=>assert.notDeepEqual(v,b[k]))
    }
    await exit(p);await ticket(p);await next(p);await exit(p)
    const sample=await resources(p);assert.deepEqual(sample,baseline);checks.cycles.push(sample)
  }
  const a=await movement(p);await p.waitForTimeout(360);const b=await movement(p);a.forEach((v,k)=>assert.notDeepEqual(v,b[k]))
  checks.checks.push('两章交替十轮；轨道归还，双环、天线、NewCrisp 显示灯在章内与退出后继续运行')
  await enter(p,'quota');await p.evaluate(()=>window.__cv.restart());await settle(p)
  assert.equal((await snap(p)).api,undefined)
  await enter(p,'success');await p.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await p.getByText('图形上下文已中断，可重新加载场景。').waitFor()
  await btn(p,'重新加载').click();await p.waitForFunction(()=>window.__cv?.snapshot().modelCount===1)
  assert.equal((await snap(p)).api,undefined)
  checks.checks.push('活动章节卸载、实际 WEBGL_lose_context 和重新加载通过')
  await ctx.close()
  const mob=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined,reducedMotion:'reduce'})
  const m=await mob.newPage();observe(m);await start(m);await enter(m,'invalid',{auto:true})
  assert.equal((await state(m)).playing,false)
  while((await state(m)).step!=='invalid')await next(m)
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await m.evaluate(()=>window.scrollTo(0,0));await capture(m,'api-mobile')
  checks.checks.push('桌面 Chrome 触屏视口、减少动态、手动推进')
  await mob.close()
  assert.deepEqual(checks.unexpectedRequests,[]);assert.deepEqual(checks.pageErrors,[])
  checks.passed=true
} finally {await json('api-checks.json',checks);await browser.close()}
