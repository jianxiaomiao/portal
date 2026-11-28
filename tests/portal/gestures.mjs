import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {chromium,devices} from 'playwright'
const browser=await chromium.launch({channel:'chrome',headless:true})
const base=process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
try{
  const page=await browser.newPage({...devices['iPhone 13'],defaultBrowserType:undefined,reducedMotion:'reduce'})
  await page.goto(base+'explore/?inspect&place=NX')
  await page.waitForFunction(()=>window.__cv?.snapshot().selected==='NX' && !window.__cv.snapshot().moving)
  const session=await page.context().newCDPSession(page)
  async function swipe(){
    const canvas=page.locator('[data-map]')
    await canvas.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}))
    await page.waitForTimeout(160)
    const box=await canvas.boundingBox()
    const x=box.x+box.width*.44, start=box.y+box.height*.66
    const before=await page.evaluate(()=>({scroll:scrollY,camera:window.__cv.snapshot().camera}))
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]})
    for(let i=1;i<=12;i++){
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*3,y:start-i*10}]})
      await page.waitForTimeout(22)
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await page.waitForTimeout(700)
    const after=await page.evaluate(()=>({scroll:scrollY,camera:window.__cv.snapshot().camera}))
    return {scrollDelta:after.scroll-before.scroll,cameraDelta:Math.hypot(...after.camera.map((n,i)=>n-before.camera[i]))}
  }
  const reading=await swipe()
  await page.getByRole('button',{name:'开始操控'}).click()
  const rotating=await swipe()
  await page.getByRole('button',{name:'结束操控'}).click()
  const released=await swipe()
  assert.ok(reading.scrollDelta>30 && reading.cameraDelta<.01,JSON.stringify(reading))
  assert.ok(Math.abs(rotating.scrollDelta)<2 && rotating.cameraDelta>.2,JSON.stringify(rotating))
  assert.ok(released.scrollDelta>30,JSON.stringify(released))
  const results={browser:browser.version(),device:'iPhone 13 emulated touch input',reading,rotating,released}
  await writeFile(new URL('../../reports/integration/gestures.json',import.meta.url),JSON.stringify(results,null,2))
  console.log(results)
}finally{await browser.close()}
