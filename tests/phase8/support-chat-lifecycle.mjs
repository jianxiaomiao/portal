import assert from 'node:assert/strict'
import {chromium,devices} from 'playwright'
import {base,desktop,chromeOptions,ready,settle,start,snap,capture,json} from './common.mjs'
import {button,openChapter,next,exit,resources} from './support-chat-ui.mjs'
const browser=await chromium.launch(chromeOptions)
const report={browser:browser.version(),cycles:[],models:[],windows:[],checks:[],errors:[]}
async function sample(p,name,ms=4000,action) {
  const w=p.evaluate(ms=>window.__cv.sample(ms),ms)
  const [metrics]=await Promise.all([w,action?.()])
  const {frameIntervalsMs,...summary}=metrics
  report.windows.push({name,...summary,...await resources(p)})
}
const pose=p=>p.evaluate(()=>{
  const cv=window.__cv, buildings=cv.motion().tracks.buildings
  const get=id=>cv.inspectObject(id)
  return {wave:[buildings.wave.material.uuid,buildings.wave.visible,buildings.wave.scale.x,buildings.wave.material.opacity],
    display:[buildings.display.material.uuid,buildings.display.visible,buildings.display.material.opacity],
    rings:get('ENV.Control.OrbitTeal').quaternion.toArray(),dish:get('NX.Array.Dish').quaternion.toArray(),
    roller:get('FO.Roller.01').quaternion.toArray(),van:cv.snapshot().motion.van}
})
async function until(p,step) {
  for(let i=0;i<50;i++){
    const s=(await snap(p)).chat
    if(s.step===step)return s
    assert.ok(!s.finished)
    await next(p)
  }
  throw Error('未到达 '+step)
}
async function frame(p) {
  const result=await p.evaluate(()=>{
    const cv=window.__cv,root=cv.inspectObject('NC.Root')
    let scene=root;while(scene.parent)scene=scene.parent
    const line=scene.getObjectByName('Chapter03.IdentityRoute'), packet=scene.getObjectByName('Chapter03.Envelope')
    const canvas=document.querySelector('canvas'),box=canvas.getBoundingClientRect()
    const positions=['NX.Anchor.DataPort','NC.Anchor.DataPort','NC.Anchor.Tower'].map(id=>cv.project(id))
    const s=cv.snapshot()
    // Orthographic projection from the actual rig pose and current frustum.
    const direction=root.position.clone().fromArray(s.target).sub(root.position.clone().fromArray(s.camera)).normalize()
    const right=direction.clone().cross(root.up).normalize(),up=right.clone().cross(direction).normalize()
    const target=root.position.clone().fromArray(s.target)
    const height=Math.max(14,23*box.height/box.width)/s.zoom
    const project=point=>{
      const v=point.clone().sub(target)
      return [box.width/2+v.dot(right)*box.height/height,box.height/2-v.dot(up)*box.height/height]
    }
    const vert=line.geometry.getAttribute('position'), samples=[]
    for(let i=0;i<vert.count;i++)samples.push(project(root.position.clone().fromBufferAttribute(vert,i)))
    const edge=Math.min(...samples.flatMap(([x,y])=>[x,box.width-x,y,box.height-y]))
    return {model:s.modelFile,positions,width:box.width,height:box.height,edge,
      packet:packet.position.toArray(),facing:packet.getWorldDirection(root.position.clone()).dot(direction.clone().negate()),view:s.view,points:vert.count,
      anchors:['NX.Anchor.DataPort','NC.Anchor.DataPort','NC.Anchor.Tower','NC.Anchor.MessageIntake','NC.Anchor.SupportDesk'].map(id=>cv.inspectObject(id).getWorldPosition(root.position.clone()).toArray())}
  })
  assert.equal(result.view,'chat-link');assert.equal(result.points,81)
  assert.ok(result.facing>.999,'信封应朝向相机')
  assert.ok(result.edge>8,JSON.stringify(result))
  assert.ok(result.positions.every(p=>p.x>0 && p.x<result.width && p.y>0 && p.y<result.height))
  return result
}
try {
  const p=await browser.newPage(desktop);p.on('pageerror',e=>report.errors.push(e.message))
  await p.goto(base+'?inspect&model=raw');await ready(p);await settle(p);const baseline=await resources(p)
  await sample(p,'总览待机')
  await p.locator('[data-place="NC"]').click();await settle(p);await sample(p,'通信邮局特写');await exit(p)
  await openChapter(p,'chat','normal',true)
  await p.waitForFunction(()=>window.__cv.snapshot().chat.step==='issue')
  await sample(p,'身份接入播放',4400)
  await button(p,'暂停').click()
  const frozen=(await snap(p)).chat;await p.waitForTimeout(650);assert.equal((await snap(p)).chat.fraction,frozen.fraction)
  await button(p,'继续').click();await p.waitForFunction(f=>window.__cv.snapshot().chat.fraction!==f,frozen.fraction)
  await next(p);assert.equal((await snap(p)).chat.playing,false)
  await button(p,'重播').click();assert.equal((await snap(p)).chat.step,'launch')
  await until(p,'history');await settle(p)
  await button(p,'继续').click();await sample(p,'坐席至回复播放',4500)
  await exit(p);assert.deepEqual(await resources(p),baseline)
  report.checks.push('暂停、继续、单步暂停、重播及取消')
  await button(p,'暂停动画').click()
  const before=await pose(p)
  await openChapter(p,'chat')
  await until(p,'issue');await settle(p);report.models.push(await frame(p));await capture(p,'chat-route')
  await until(p,'ticket');await settle(p)
  await sample(p,'环境暂停时章节独立发光',1500,async()=>{await button(p,'继续').click()})
  await exit(p)
  assert.deepEqual(await pose(p),before)
  assert.equal(report.windows.at(-1).shadowUpdates,0)
  report.checks.push('章节单独运行不刷新阴影；NC 波纹、灯光、引用及全部抽测环境姿态逐项复位')
  await button(p,'开启动画').click()
  await openChapter(p,'chat')
  await until(p,'history');await settle(p)
  report.deskFrame=await p.evaluate(()=>{
    const cv=window.__cv,canvas=document.querySelector('canvas')
    const tower=cv.project('NC.Anchor.DataPort'),desk=cv.project('NC.Anchor.SupportDesk')
    const inside=point=>point.x>12 && point.x<canvas.clientWidth-12 && point.y>12 && point.y<canvas.clientHeight-12
    return {tower,desk,inside:inside(tower)&&inside(desk)}
  })
  assert.ok(report.deskFrame.inside,JSON.stringify(report.deskFrame))
  await capture(p,'chat-desk');const moving=await pose(p)
  await p.waitForTimeout(470);const later=await pose(p)
  for(const key of ['display','rings','dish','roller','van'])assert.notDeepEqual(moving[key],later[key],key)
  assert.deepEqual((await snap(p)).motion.owners,[]);await exit(p)
  for(let cycle=0;cycle<10;cycle++){
    for(const id of ['api','journey','chat']){
      await openChapter(p,id)
      await next(p)
      if(id==='chat')await next(p)
      const s=await snap(p);assert.equal(['api','journey','chat'].filter(k=>s[k]).length,1)
      await button(p,'取消演示').click()
    }
    await settle(p);assert.equal((await snap(p)).view,'home');const r=await resources(p);assert.deepEqual(r,baseline)
    report.cycles.push(r)
  }
  await sample(p,'退出后总览',3000)
  await sample(p,'连续切换三章',6500,async()=>{
    for(const id of ['api','journey','chat']){
      await openChapter(p,id);await next(p);await p.waitForTimeout(500);await button(p,'取消演示').click()
    }
    await settle(p)
  })
  await openChapter(p,'chat');await next(p);await p.evaluate(()=>window.__cv.restart())
  await ready(p);assert.equal((await snap(p)).chat,undefined)
  await openChapter(p,'chat');await next(p)
  await p.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await p.getByText('图形上下文已中断，可重新加载场景。').waitFor()
  await button(p,'重新加载').click();await ready(p);await settle(p)
  // Portal restores the chapter selector after context loss; the original
  // Phase 8 comparison sampled the default overview after a blank restart.
  const restored=await snap(p)
  assert.equal(restored.selected,'hub')
  assert.equal(restored.chat,undefined)
  assert.ok(await p.getByLabel('客服剧情').isVisible())
  report.contextRestore={selected:restored.selected,view:restored.view,selector:await p.getByLabel('客服剧情').inputValue(),hubResources:await resources(p)}
  await button(p,'返回总览').click();await settle(p)
  assert.equal((await snap(p)).view,'home')
  await p.waitForFunction(expected=>window.__cv.snapshot().geometries===expected,baseline.geometry,{timeout:10000})
  report.contextRestore.overviewResources=await resources(p)
  assert.deepEqual(report.contextRestore.overviewResources,baseline)
  report.checks.push('三章十轮、章节卸载、真实 WebGL 上下文丢失及恢复')
  await p.goto(base+'?inspect&model=meshopt');await ready(p);await openChapter(p,'chat')
  await until(p,'issue');await settle(p);report.models.push(await frame(p))
  assert.deepEqual(report.models[0].anchors,report.models[1].anchors);assert.deepEqual(report.models[0].packet,report.models[1].packet)
  await until(p,'seen');assert.equal((await snap(p)).chat.counterpartRead,2);await p.close()
  const mobile=await browser.newPage({...devices['iPhone 13'],defaultBrowserType:undefined,reducedMotion:'reduce'})
  await start(mobile);await openChapter(mobile,'chat','normal',true);assert.equal((await snap(mobile)).chat.playing,false)
  await until(mobile,'issue');await settle(mobile);report.mobileRoute=await frame(mobile)
  await mobile.evaluate(()=>scrollTo(0,0));await capture(mobile,'chat-mobile-route')
  await until(mobile,'seen')
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  const map=await mobile.locator('canvas').boundingBox(),panel=await mobile.locator('[data-chat-panel]').boundingBox()
  assert.ok(panel.y>=map.y+map.height-1)
  await mobile.locator('[data-client]').scrollIntoViewIfNeeded()
  await capture(mobile,'chat-mobile-panels')
  const beforeSideChange=(await snap(mobile)).chat
  await button(mobile,'坐席工作台').click()
  assert.ok(await mobile.locator('[data-staff]').isVisible())
  assert.ok(!await mobile.locator('[data-client]').isVisible())
  assert.deepEqual((await snap(mobile)).chat,beforeSideChange)
  await capture(mobile,'chat-mobile-staff')
  await button(mobile,'客户窗口').click()
  assert.ok(await mobile.locator('[data-client]').isVisible())
  assert.ok(!await mobile.locator('[data-staff]').isVisible())
  assert.deepEqual((await snap(mobile)).chat,beforeSideChange)
  report.checks.push('手机双端视图切换保留完整剧情快照、消息与阅读水位')
  await mobile.close();assert.deepEqual(report.errors,[]);report.passed=true
} finally {await json('chat-lifecycle.json',report);await browser.close()}
