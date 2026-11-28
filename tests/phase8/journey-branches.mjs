import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright'
import { desktop, chromeOptions, start, settle, snap, physical, json, capture, base } from './common.mjs'
const browser = await chromium.launch(chromeOptions)
const r={ checks:[], requests:[], traces:{}, errors:[] }
const button=(p,name)=>p.getByRole('button',{name,exact:true})
const state=async p=>(await snap(p)).journey
async function enter(p,s) {
  await p.locator('[data-place="hub"]').click()
  await button(p,'可靠工单投递').click()
  await p.getByLabel('选择剧情').selectOption(s)
  await button(p,'分步播放').click()
}
async function next(p) { await button(p,'下一步').click(); return state(p) }
async function cancel(p){ await p.keyboard.press('Escape');await settle(p);assert.equal((await snap(p)).journey,undefined);assert.deepEqual((await snap(p)).motion.owners,[]) }
function check(name) {r.checks.push(name);console.log('PASS',name)}
try {
  const ctx=await browser.newContext(desktop), p=await ctx.newPage()
  p.on('pageerror',e=>r.errors.push(e.message))
  p.on('request',req=>r.requests.push(req.url()))
  await start(p)
  // Pause ambient movement to compare every stable node before/after cancellation.
  await button(p,'暂停动画').click()
  const pose=()=>p.evaluate(()=>{const root=window.__cv.inspectObject('ENV.Root').parent,out={}
    root.traverse(n=>{if(n.userData.codeville_id)out[n.userData.codeville_id]=[...n.position,...n.quaternion,...n.scale,n.visible]});return out})
  const before=await pose()
  for(const s of ['lost','normal','invalid','stale','conflict']) {
    await enter(p,s)
    const trace=[];let j=await state(p);const id=j.parcelUuid;let previous,oldAck
    while(!j.finished) {
      trace.push({step:j.step,outbox:j.outbox,flow:j.flow,attempt:j.attempt,token:j.token,http:j.http,rows:j.written,imports:j.imports,assignments:j.assignments})
      assert.equal(j.parcelUuid,id);assert.ok(j.imports<=1);assert.ok(j.assignments<=1)
      if(j.step==='inserts'){assert.equal(j.ticketId,'');assert.equal(j.outbox,'—')}
      if(j.step==='local')assert.equal(j.outbox,'PENDING')
      if(j.step==='claim'){previous=j;assert.equal(j.attempt,1);assert.equal(j.leased,true)}
      if(j.step==='imported'){
        oldAck=j.ack;assert.equal(j.http,201);assert.equal(j.flow,'ASSIGNED');assert.equal(j.imports,1);assert.equal(j.outbox,'PROCESSING')
        if(s==='normal'){
          await button(p,'客服领取').click();assert.equal((await state(p)).flow,'ACCEPTED')
          await button(p,'开始处理').click();assert.equal((await state(p)).flow,'PROCESSING');assert.equal((await state(p)).outbox,'PROCESSING')
        }
      }
      if(j.step==='lost'){
        assert.equal(j.ack,null);assert.equal(j.flow,'ASSIGNED');assert.equal(j.outbox,'PROCESSING')
        if(s==='lost'){await settle(p);await capture(p,'journey-lost')}
      }
      if(j.step==='wait'){assert.equal(j.failure,'NETWORK_ERROR');assert.equal(j.outbox,'PENDING')}
      if(j.step==='reclaim'){assert.equal(j.attempt,2);assert.notEqual(j.token,previous.token);assert.deepEqual(j.request,previous.request);assert.equal(j.ticketId,previous.ticketId)}
      if(j.step==='match'){assert.equal(j.http,200);assert.deepEqual(j.ack,oldAck);assert.equal(j.requestDigest,j.link.digest)}
      if(j.step==='bad'){assert.notEqual(j.ack.eventId,j.request.eventId);assert.equal(j.checked,false);assert.equal(j.outbox,'PROCESSING')}
      if(j.step==='badwait'){assert.equal(j.failure,'INVALID_ACK');assert.equal(j.outbox,'PENDING')}
      if(j.step==='expire'){assert.equal(j.leased,false);assert.equal(j.outbox,'PROCESSING')}
      if(j.step==='stale'){assert.equal(j.written,0);assert.equal(j.outbox,'PROCESSING');assert.equal(j.leased,true);assert.notEqual(j.expiredReply.token,j.token)}
      if(j.step==='mismatch'){assert.equal(j.http,409);assert.notEqual(j.requestDigest,j.link.digest);assert.equal(j.imports,1)}
      if(j.step==='blocked'){assert.equal(j.outbox,'BLOCKED');assert.equal(j.failure,'HTTP_409')}
      if(j.step==='valid'){assert.equal(j.checked,true);assert.equal(j.outbox,'PROCESSING');assert.equal(j.confirmedNo,'')}
      if(j.step==='done'){assert.equal(j.written,1);assert.equal(j.confirmedNo,oldAck.ticketNo);assert.equal(j.outbox,'DELIVERED')}
      j=await next(p)
    }
    assert.deepEqual((await snap(p)).motion.owners,[]);assert.deepEqual(await pose(),before)
    r.traces[s]=trace;check('分步剧情与资源复位 '+s);await cancel(p)
  }
  await enter(p,'lost');await next(p)
  await button(p,'继续播放').click();await p.waitForTimeout(450);await button(p,'暂停剧情').click()
  const frozen=await state(p);await p.waitForTimeout(360);assert.equal((await state(p)).fraction,frozen.fraction)
  await button(p,'从头重播').evaluate(el=>{el.click();el.click();el.click()})
  assert.deepEqual((await snap(p)).motion.owners,['vehicle','mechanics']);assert.equal((await state(p)).step,'draft')
  await cancel(p);assert.deepEqual(await pose(),before);check('暂停继续、连点重播、中途取消及 全部稳定节点复位')
  await enter(p,'normal')
  // Switch using a real front-most raycast on the town.
  await settle(p);const hit=await physical(p,'NX');await p.mouse.click(hit.x,hit.y)
  await settle(p);assert.equal((await snap(p)).selected,'NX');assert.deepEqual((await snap(p)).motion.owners,[]);assert.equal((await snap(p)).journey,undefined)
  await button(p,'返回总览').click();await settle(p);check('点选建筑切换时归还控制权')
  await p.locator('[data-place="hub"]').click()
  await button(p,'可靠工单投递').click()
  await p.evaluate(()=>{window.__returnMechanics=window.__cv.motion().claim('mechanics')})
  await button(p,'分步播放').click()
  assert.equal((await snap(p)).journey,undefined)
  assert.deepEqual((await snap(p)).motion.owners,['mechanics'])
  assert.equal((await snap(p)).selected,null)
  await p.evaluate(()=>window.__returnMechanics())
  check('部分认领失败时归还已借车辆并保留其他拥有者')
  await enter(p,'lost');await next(p)
  await p.evaluate(()=>window.__cv.restart());await p.waitForFunction(()=>!!window.__cv && !window.__cv.snapshot().journey && !window.__cv.snapshot().motion.owners.length)
  check('演示中场景重载后清理')
  assert.equal(r.requests.filter(x=>/\/Town(?:\.meshopt)?\.glb$/.test(new URL(x).pathname)).length,2)
  assert.ok(r.requests.every(x=>new URL(x).origin===new URL(base).origin||x.startsWith('blob:')||x.startsWith('data:')))
  assert.ok(!r.requests.some(x=>x.includes('/api/')||x.includes('/integration/')));check('每次场景装载一次 Town，剧情期间无新增模型及业务请求')
  const probe = () => p.evaluate(() => {
    const cv = window.__cv
    return {van:cv.snapshot().motion.van,
      roller:cv.inspectObject('FO.Roller.01').quaternion.toArray(),
      parcel:cv.inspectObject('FO.Move.Parcel1').position.toArray()}
  })
  await enter(p,'normal');await next(p);await cancel(p)
  await p.waitForFunction(()=>window.__cv.snapshot().motion.distance > 1)
  const a=await probe();await p.waitForTimeout(450);const b=await probe()
  for (const key of ['van','roller','parcel']) assert.notDeepEqual(a[key],b[key])
  await button(p,'观察服务车').click();await settle(p);assert.equal((await snap(p)).view,'vehicle')
  await button(p,'返回总览').click()
  await p.locator('[data-place="FO"]').click();await button(p,'观察传送带').click()
  await settle(p);assert.equal((await snap(p)).view,'conveyor')
  check('退出后车辆行驶、滚轮与包裹持续运动，跟车与传送带特写可用')
  await ctx.close()
  const mobile=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined,reducedMotion:'reduce'})
  const m=await mobile.newPage();await start(m)
  await m.locator('[data-place="hub"]').click();await button(m,'可靠工单投递').click()
  await button(m,'自动播放').click();assert.equal((await state(m)).playing,false)
  await next(m);await next(m);assert.equal((await state(m)).playing,false)
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await capture(m,'journey-mobile');await cancel(m);await mobile.close();check('移动触屏视口、减少动态偏好及退出')
  assert.deepEqual(r.errors,[]);r.passed=true
} finally {await json('journey-branches.json',r);await browser.close()}
