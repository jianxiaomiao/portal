import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright'
import { desktop, chromeOptions, start, settle, home, change, physical, snap, capture, file, json, ready, base } from './common.mjs'
const browser = await chromium.launch(chromeOptions)
const evidence = { views: [], clicks: [], hotspots: [], errors: [] }
const button = (p, name) => p.getByRole('button', { name, exact: true })
async function photograph(p, view) {
  await settle(p)
  await p.mouse.move(1, 1)
  const s = await snap(p)
  assert.equal(s.view, view)
  await capture(p, 'town-' + view)
  evidence.views.push({ view, camera: s.camera, target: s.target, zoom: s.zoom })
}
try {
  const p = await browser.newPage(desktop)
  p.on('pageerror', e => evidence.errors.push(e.message))
  p.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()) })
  await start(p)
  await photograph(p, 'home')
  await p.locator('canvas').screenshot({ path:file('screenshots/town-poster.png') })
  for (const [view, name] of Object.entries({plan:'鸟瞰',reverse:'反向',residential:'住宅街',market:'街市',quay:'滨水公园'})) {
    await button(p,name).click()
    await photograph(p,view)
    assert.equal((await snap(p)).selected,null)
  }
  await home(p)
  // Aim at an actual terrace house in overview. Its marker is at the building's origin.
  const house = await p.evaluate(() => window.__cv.project('ENV.V1.Terrace.House2'))
  const box = await p.locator('canvas').boundingBox()
  await p.mouse.click(box.x+house.x, box.y+house.y-8)
  assert.equal((await snap(p)).selected,null)
  for (const key of ['NX','FO','NC','ST','hub']) {
    const pos = await physical(p,key)
    await p.mouse.click(pos.x,pos.y)
    await photograph(p,key)
    assert.equal((await snap(p)).selected,key)
    evidence.clicks.push(key)
    if (key === 'ST') {
      await button(p,'展开工作室').click()
      await p.waitForFunction(()=>window.__cv.snapshot().studio.progress===1)
      await photograph(p,'exploded')
      await button(p,'观察室内').click()
      await settle(p)
      for (const name of ['电脑','咖啡杯','书架','白板','开发笔记','雪景球']) {
        await button(p,name+'热点').click()
        assert.ok((await p.locator('.hot-info').innerText()).length>10)
        evidence.hotspots.push(name)
      }
      await p.locator('.hot-info button').click()
      await photograph(p,'globe')
    }
    await home(p)
  }
  await p.goto(base+'?inspect&model=meshopt')
  await ready(p)
  const compact = await snap(p)
  assert.equal(compact.ids,196)
  assert.equal(compact.modelCount,1)
  evidence.meshopt = { ids:compact.ids, bytes:compact.bytes, file:compact.modelFile }
  await p.close()
  const m = await browser.newPage({...devices['iPhone 13'],defaultBrowserType:undefined})
  await start(m)
  await capture(m,'town-mobile')
  for (const key of ['residential','market','quay']) {
    await m.locator('[data-view='+key+']').click()
    await settle(m)
    assert.equal((await snap(m)).view,key)
  }
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  evidence.mobile = 'iPhone 13 viewport, desktop Chrome'
  assert.deepEqual(evidence.errors,[])
  evidence.passed=true
} finally { await json('town-views.json', evidence); await browser.close() }
