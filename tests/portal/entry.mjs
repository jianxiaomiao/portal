import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'

const base=process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
const browser=await chromium.launch({channel:'chrome',headless:true})
const evidence={}
try{
  const first=await browser.newPage({viewport:{width:1440,height:900}})
  await first.goto(base+'explore/?inspect')
  const skip=first.getByRole('button',{name:'跳过入场'})
  await skip.click()
  const view=()=>first.evaluate(()=>window.__cv.snapshot())
  assert.equal((await view()).entering,false)
  evidence.skip=(await view()).view
  await first.reload()
  await first.waitForFunction(()=>!!window.__cv)
  assert.equal((await view()).entering,false)
  evidence.repeatEntry=false
  await first.close()

  const second=await browser.newPage()
  await second.goto(base+'explore/?inspect')
  await second.getByRole('button',{name:'跳过入场'}).waitFor()
  await second.locator('[data-place=NC]').click()
  await second.waitForTimeout(2800)
  const accepted=await second.evaluate(()=>window.__cv.snapshot())
  assert.equal(accepted.selected,'NC');assert.equal(accepted.entering,false)
  evidence.interrupted=accepted.view
  await second.close()

  const reduced=await browser.newPage({reducedMotion:'reduce'})
  await reduced.goto(base+'explore/?inspect')
  await reduced.waitForFunction(()=>!!window.__cv)
  assert.equal(await reduced.getByRole('button',{name:'跳过入场'}).count(),0)
  evidence.reduced=await reduced.evaluate(()=>window.__cv.snapshot().motion.reduced)
  await reduced.locator('[data-place=FO]').click()
  await reduced.waitForFunction(()=>window.__cv.snapshot().view==='FO' && !window.__cv.snapshot().moving)
  await reduced.getByLabel('切换昼夜').click()
  await reduced.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await reduced.getByRole('button',{name:'重新加载'}).click()
  await reduced.waitForFunction(()=>window.__cv?.snapshot().selected==='FO')
  evidence.recovered=await reduced.evaluate(()=>({place:window.__cv.snapshot().selected,theme:window.__cv.snapshot().theme}))
  assert.deepEqual(evidence.recovered,{place:'FO',theme:'night'})
  await reduced.close()
  const noData=await browser.newPage()
  await noData.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}))
  await noData.goto(base+'explore/')
  assert.equal(await noData.locator('canvas').count(),0)
  await noData.locator('[data-enable]').click()
  await noData.waitForSelector('[data-stage=ready]')
  evidence.saveDataManual=true
  console.log(evidence)
}finally{
  await browser.close()
  const directory=new URL('../../reports/integration/',import.meta.url)
  await mkdir(directory,{recursive:true})
  await writeFile(new URL('entry.json',directory),JSON.stringify(evidence,null,2))
}
