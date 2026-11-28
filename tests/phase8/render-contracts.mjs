import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { base, chromeOptions, desktop, ready, settle, json, home } from './common.mjs'
const browser=await chromium.launch(chromeOptions)
const results=[]
try {
  for(const model of ['raw','meshopt']){
    const page=await browser.newPage(desktop)
    await page.goto(base+'?inspect&model='+model)
    await ready(page)
    await settle(page)
    const scene=await page.evaluate(async()=>{
      const cv=window.__cv
      const root=cv.inspectObject('ENV.Root').parent
      const streets=[]
      root.traverse(o=>{
        if(o.isMesh && o.material?.name==='Garden • painted enamel and foliage') streets.push(o)
      })
      const water=root.getObjectByName('Quay.Water'), bed=root.getObjectByName('Quay.Riverbed')
      const waterway={ surfaceVertices:water?.geometry.getAttribute('position').count,
        transparent:water?.material.transparent, depthWrite:water?.material.depthWrite,
        opaqueBank:water?.parent.material.transparent===false,
        bedBelow:bed?.position.y<water?.position.y, gravel:!!root.getObjectByName('Quay.SubmergedGravel') }
      const tower=cv.inspectObject('NC.Anchor.Tower')
      const wave=tower.children.find(o=>o.geometry?.type==='RingGeometry')
      if(!wave) throw Error('通信塔波纹缺失')
      const arm=cv.inspectObject('FO.Joint.Elbow')
      let low=1, high=0, visible=false, hidden=false
      const armAngles=[]
      const start=performance.now()
      while(performance.now()-start<8050){
        low=Math.min(low,wave.material.opacity);high=Math.max(high,wave.material.opacity)
        visible ||= wave.visible;hidden ||= !wave.visible
        armAngles.push(arm.quaternion.z)
        await new Promise(r=>setTimeout(r,75))
      }
      return {waterway,ids:cv.snapshot().ids, streetDrawables:streets.length,
        staticOnly:streets.every(o=>o.layers.mask===4), bakes:cv.snapshot().streetShadowBakes,
        waveOpacity:[low,high], visible,hidden,elbowZ:[Math.min(...armAngles),Math.max(...armAngles)],
        network:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.glb')).map(r=>({file:new URL(r.name).pathname,body:r.encodedBodySize,transfer:r.transferSize}))}
    })
    assert.deepEqual(scene.waterway,{surfaceVertices:12,transparent:true,depthWrite:false,opaqueBank:true,bedBelow:true,gravel:true})
    assert.equal(scene.ids,196)
    assert.ok(scene.streetDrawables>0 && scene.staticOnly)
    assert.equal(scene.bakes,1)
    assert.ok(scene.visible && scene.hidden && scene.waveOpacity[1]>.38 && scene.waveOpacity[0]<.02)
    assert.ok(scene.elbowZ[1]>scene.elbowZ[0]+.001)
    assert.equal(scene.network.length,1)
    await page.locator('[data-view=market]').click(); await settle(page)
    await home(page)
    assert.equal(await page.evaluate(()=>window.__cv.snapshot().streetShadowBakes),1)
    results.push({model,...scene})
    await page.close()
  }
  assert.equal(results[0].streetDrawables,results[1].streetDrawables)
  await json('render-contracts.json',results)
}finally{await browser.close()}
