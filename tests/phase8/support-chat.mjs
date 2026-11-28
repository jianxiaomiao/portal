import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {mkdir,mkdtemp,rm,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {desktop,chromeOptions,base,file,json,snap,settle,start,capture} from './common.mjs'
import {button,openChapter,next,resources,exit} from './support-chat-ui.mjs'
const browser=await chromium.launch(chromeOptions)
const names={normal:'一条客服消息',lost:'保存后ACK丢失',offline:'断线后补拉',transfer:'领取竞争与主管转派',switch:'三章连续切换'}
const reports={browser:browser.version(),scenarios:{},films:[],errors:[],unexpectedRequests:[]}
await mkdir(file('screenshots'),{recursive:true})

async function validateVideo(path) {
  const review=await browser.newPage()
  try {
    await review.setContent('<input type="file">')
    await review.locator('input').setInputFiles(path)
    const meta=await review.evaluate(async()=>{
      const video=document.createElement('video'), canvas=document.createElement('canvas')
      const event=name=>new Promise((resolve,reject)=>{
        video.addEventListener(name,resolve,{once:true});video.onerror=()=>reject(Error('无法解码录屏'))
      })
      const loaded=event('loadedmetadata')
      video.src=URL.createObjectURL(document.querySelector('input').files[0]);await loaded
      canvas.width=96;canvas.height=60
      const context=canvas.getContext('2d'), frames=[]
      for(const fraction of [.24,.52,.84]){
        const sought=event('seeked');video.currentTime=video.duration*fraction;await sought
        context.drawImage(video,0,0,96,60)
        frames.push(context.getImageData(0,0,96,60).data.reduce((a,b)=>a+b,0))
      }
      return {seconds:video.duration,width:video.videoWidth,height:video.videoHeight,frames}
    })
    assert.equal(meta.width,1440);assert.equal(meta.height,900);assert.ok(new Set(meta.frames).size>1)
    return {...meta,bytes:(await stat(path)).size}
  } finally {await review.close()}
}

function verify(s,trace,scenario) {
  assert.deepEqual(s.rows.map(row=>row.seq),s.rows.map((_,i)=>i+1))
  assert.equal(s.messageEvents,s.rows.length)
  const before=trace.at(-1)
  switch(s.step) {
    case 'grant':assert.match(s.grant,/已签发/);assert.equal(s.session,false);break
    case 'bind':assert.equal(s.grant,'已消费');assert.equal(s.session,true);assert.equal(s.access,false);break
    case 'jwt':assert.equal(s.access,true);assert.equal(s.clientTicket,0);break
    case 'ticket':assert.equal(s.clientTicket,1);assert.equal(s.clientWs,'已领票');break
    case 'upgrade':assert.equal(s.clientWs,'已升级 · 待认证');break
    case 'ready':assert.equal(s.clientWs,'ready');assert.equal(s.status,'—');assert.equal(s.staffWs,'离线');break
    case 'receive':assert.equal(s.rows.length,0);assert.equal(s.pending,'发送中');break
    case 'commit':assert.equal(s.rows.length,1);assert.equal(s.ack,'');assert.equal(s.owner,'');assert.equal(s.status,'WAITING');break
    case 'lost':assert.equal(s.waitingForRetry,true);assert.equal(s.ack,'');assert.equal(s.draft,s.rows[0].text);break
    case 'retry':assert.equal(s.key,before.key);assert.notEqual(s.requestId,before.requestId);break
    case 'replay':assert.ok(s.replayed);assert.equal(s.rows.length,1);assert.equal(s.messageEvents,1);assert.equal(s.ack,s.requestId);break
    case 'queue':assert.equal(s.staffWs,'ready');assert.equal(s.staffSeq,0);break
    case 'race':assert.equal(s.version,0);assert.equal(s.owner,'');break
    case 'winner':assert.match(s.action,/200.*409/);break
    case 'claim':assert.equal(s.owner,'A');assert.equal(s.version,1);break
    case 'history':assert.equal(s.status,'ACTIVE');assert.equal(s.selected,'S1');assert.equal(s.staffSeq,1);break
    case 'transfer':assert.equal(s.owner,'B');assert.equal(s.version,2);assert.equal(s.staffWs,'ready');break
    case 'answer':assert.equal(s.rows.length,1);assert.equal(s.owner,scenario==='transfer'?'B':'A');break
    case 'answerCommit':assert.equal(s.rows.length,2);assert.equal(s.staffSeq,1);assert.equal(s.clientSeq,1);break
    case 'answerAck':assert.equal(s.staffSeq,2);assert.equal(s.clientSeq,1);break
    case 'dispatch':assert.equal(s.clientSeq,1);if(scenario==='offline')assert.equal(s.clientWs,'离线');break
    case 'reready':assert.equal(s.clientTicket,2);assert.equal(s.clientSeq,1);break
    case 'pull':assert.match(s.protocol,/afterSeq=1/);assert.equal(s.clientSeq,1);break
    case 'display':case 'merge':assert.equal(s.clientSeq,2);assert.equal(s.clientRead,0);break
    case 'read':assert.equal(s.clientRead,2);assert.equal(s.counterpartRead,0);break
    case 'seen':assert.equal(s.counterpartRead,2);assert.equal(s.status,'ACTIVE');break
  }
}
async function record(id) {
  const tmp=await mkdtemp(join(tmpdir(),'codeville-film-'))
  const ctx=await browser.newContext({...desktop,recordVideo:{dir:tmp,size:desktop.viewport}})
  const p=await ctx.newPage(),video=p.video()
  const trace=[]
  p.on('pageerror',e=>reports.errors.push(e.message))
  p.on('request',r=>{
    const u=new URL(r.url())
    if(!['blob:','data:'].includes(u.protocol)&&(u.origin!==new URL(base).origin||/^\/(?:api|ws|integrations|launch)\//.test(u.pathname)))reports.unexpectedRequests.push(u.href)
  })
  try {
    await start(p);await p.mouse.move(4,4)
    const initial=await resources(p)
    if(id==='switch') {
      for(const [key,steps] of [['api',2],['journey',4],['chat',5]]){
        await openChapter(p,key)
        for(let i=0;i<steps;i++){await next(p);await p.waitForTimeout(600)}
        assert.ok((await snap(p))[key])
        await button(p,'取消演示').click();await settle(p)
        assert.deepEqual(await resources(p),initial)
      }
    } else {
      const auto=id==='normal'
      await openChapter(p,'chat',id,auto)
      let s=(await snap(p)).chat
      while(!s.finished){
        verify(s,trace,id);trace.push(s)
        if(s.step==='lost'){
          await capture(p,'chat-lost');await p.waitForTimeout(1600)
          assert.equal((await snap(p)).chat.step,'lost');await button(p,'客户重试原消息').click()
        } else if(auto){
          await p.waitForFunction(step=>{
            const s=window.__cv.snapshot().chat
            return s.step!==step || s.finished
          },s.step,{timeout:20000})
        } else {
          await p.waitForTimeout(['history','transfer','reready','pull','merge','race','winner','replay','seen'].includes(s.step)?1250:600)
          if(s.step==='history'){
            await button(p,'S2').click();assert.equal(await p.locator('[data-staff] .bubble').count(),0)
            await button(p,'S1').click();assert.equal((await snap(p)).chat.staffWs,'ready')
          }
          if(s.step==='reready')await capture(p,'chat-reconnected')
          if(s.step==='seen'){
            await settle(p)
            if(id==='transfer'){
              await button(p,'坐席 A').click();assert.equal(await p.locator('[data-staff] .bubble').count(),0)
              assert.match(await p.locator('[data-staff]').innerText(),/ready/)
              await button(p,'坐席 B').click()
            }
            assert.match(await p.locator('[data-staff]').innerText(),/已读/)
            assert.match(await p.locator('[data-client]').innerText(),/可以在订单详情查看。/)
            await capture(p,'chat-'+id+'-panels')
          }
          await next(p)
        }
        s=(await snap(p)).chat
      }
      assert.equal(s.clientRead,2);assert.equal(s.rows.length,2)
      assert.ok(trace.some(s=>s.step==='commit')&&trace.some(s=>s.step==='seen'))
      await settle(p)
      if(id==='normal')await capture(p,'chat-normal-panels')
      reports.scenarios[id]={steps:trace.map(s=>s.step),trace,initial,final:await resources(p)}
      assert.deepEqual(await resources(p),initial)
    }
    await p.waitForTimeout(500)
    await ctx.close()
    const name=names[id]+'.webm',path=file(name)
    await video.saveAs(path)
    reports.films.push({name,...await validateVideo(path)})
    await json('chat-stories.json',reports)
    console.log('PASS',id,trace.length)
  } finally {await ctx.close();await rm(tmp,{recursive:true,force:true})}
}
try {
  for(const id of Object.keys(names))await record(id)
  assert.deepEqual(reports.errors,[]);assert.deepEqual(reports.unexpectedRequests,[])
  reports.passed=true
} finally {await json('chat-stories.json',reports);await browser.close()}
