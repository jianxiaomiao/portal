import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome' })
const result = {}
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(base + 'explore/?inspect')
  await p.waitForFunction(() => window.__cv?.snapshot().fps > 0)
  await p.evaluate(() => {
    let top = window.__cv.inspectObject('NX.Root')
    while (top.parent) top = top.parent
    const n = top.getObjectByName('Neighborhood'),
      [box, round] = n.children
    window.sea = top.getObjectByName('CloudSea.Shoals')
    const far = top.getObjectByName('CloudSea.Distance')
    window.scenery = n
    window.disposedEvents = {}
    const cloud = window.__cv.owner().clouds
    const objects = {
      volumeTarget: cloud.mist,
      depthTarget: cloud.opaque,
      density: cloud.state.forms[0].volume,
      fineGeometry: cloud.state.forms[0].skin,
      coarseGeometry: cloud.state.forms[0].low,
      rayBox: cloud.box,
      box,
      round,
      farGeometry: far.geometry,
      boxGeometry: box.geometry,
      roundGeometry: round.geometry,
      initialShoalGeometry: window.sea.geometry,
      actorMaterial: box.material,
      seaMaterial: window.sea.material,
      farMaterial: far.material,
      relief: far.material.uniforms.relief.value,
      shore: far.material.uniforms.coast.value,
    }
    for (const [k, obj] of Object.entries(objects)) {
      window.disposedEvents[k] = 0
      obj.addEventListener('dispose', () => window.disposedEvents[k]++)
    }
  })
  const cloudTime = () => p.evaluate(() => window.sea.material.uniforms.t.value)
  const sample = () => p.evaluate(() => window.scenery.children.map(m => Array.from(m.instanceMatrix.array.slice(0,m.count*16))))
  const running = await cloudTime()
  let a = await sample()
  await p.waitForTimeout(660)
  let c = await sample()
  assert.ok(await cloudTime() > running)
  result.changedInstances = c.map(
    (m, k) =>
      Array.from({ length: m.length / 16 }, (_, i) =>
        m.slice(i * 16, i * 16 + 16).some((v, j) => v !== a[k][i * 16 + j]),
      ).filter(Boolean).length,
  )
  assert.ok(result.changedInstances.every((x) => x > 0))
  await p.getByRole('button', { name: '暂停动画', exact: true }).click()
  a = await sample()
  const paused = await cloudTime()
  await p.waitForTimeout(500)
  assert.equal(await cloudTime(), paused)
  assert.deepEqual(await sample(), a)
  await p.getByLabel('画质', { exact: true }).selectOption('low')
  await p.waitForFunction(() => !window.scenery.visible)
  assert.ok(await p.evaluate(()=>window.sea.visible && window.sea.parent.visible && window.__cv.owner().clouds.level === 0))
  await p.getByLabel('画质', { exact: true }).selectOption('high')
  await p.waitForFunction(() => window.scenery.visible)
  await p.getByRole('button', { name: '开启动画', exact: true }).click()
  await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.waitForTimeout(100)
  a = await sample()
  const still = await cloudTime()
  await p.waitForTimeout(450)
  assert.equal(await cloudTime(), still)
  assert.deepEqual(await sample(), a)
  await p.locator('[data-place=ST]').click()
  await p.waitForFunction(() => !window.scenery.visible)
  await p.evaluate(() => {
    window.disposedEvents.finalShoalGeometry = 0
    window.sea.geometry.addEventListener('dispose', () => window.disposedEvents.finalShoalGeometry++)
  })
  // Resizing a Three.js target disposes its previous backing store. Measure
  // the final teardown separately from those legitimate quality transitions.
  const beforeExit = await p.evaluate(() => ({ ...window.disposedEvents }))
  await p.locator('.sitehead .signature').click()
  await p.waitForSelector('[data-route="/"]')
  await p.waitForFunction(() => !document.querySelector('canvas[data-map]'))
  result.disposed = await p.evaluate(() => window.disposedEvents)
  result.beforeExit = beforeExit
  for (const [name,total] of Object.entries(result.disposed))
    assert.equal(total - beforeExit[name], 1, name+' final disposal')
  result.pause = result.low = result.high = result.reduced = result.focusHidden = true
  await p.close()
  const slow = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await slow.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 75)
    window.cancelAnimationFrame = clearTimeout
  })
  await slow.goto(base + 'explore/?inspect')
  await slow.waitForFunction(() => window.__cv?.snapshot().fps > 0)
  const probe = () => {
    let scene = window.__cv.inspectObject('NX.Root')
    while (scene.parent) scene = scene.parent
    return scene.getObjectByName('Neighborhood')?.visible
  }
  await slow.waitForFunction(probe)
  await slow.waitForFunction(
    () => {
      let scene = window.__cv.inspectObject('NX.Root')
      while (scene.parent) scene = scene.parent
      return scene.getObjectByName('Neighborhood')?.visible === false
    },
    null,
    { timeout: 12000 },
  )
  await slow.getByLabel('画质', { exact: true }).selectOption('high')
  await slow.waitForFunction(probe)
  result.automaticSlowFallback = true
  await slow.close()
  const mobile = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await mobile.goto(base + 'explore/?inspect')
  await mobile.waitForFunction(() => window.__cv?.snapshot().fps > 0)
  result.autoMobileAllocated = await mobile.evaluate(() => {
    let s = window.__cv.inspectObject('NX.Root')
    while (s.parent) s = s.parent
    if (!s.getObjectByName('CloudSea.Distance') || !s.getObjectByName('CloudSea.Shoals')) throw Error('Missing mobile cloud sea')
    return !!s.getObjectByName('Neighborhood')
  })
  assert.equal(result.autoMobileAllocated, false)
  await mobile.close()
  console.log(result)
  const out = new URL('../../reports/cloud-realm-final/', import.meta.url)
  await mkdir(out, { recursive: true })
  await writeFile(new URL('ownership.json', out), JSON.stringify(result, null, 2) + '\n')
} finally {
  await b.close()
}
