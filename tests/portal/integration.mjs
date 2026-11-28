import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, devices } from 'playwright'

const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
const out = new URL('../../reports/integration/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const evidence = {
  cycles: [],
  fallback: [],
  bookmarks: {},
  mobile: {},
  races: [],
  errors: [],
  passed: false,
}
const waitReady = (p) =>
  p.waitForSelector('.cv-root [data-stage=ready]', { timeout: 60000 })
const snapshot = (p) => p.evaluate(() => window.__cv.snapshot())
const clean = () =>
  browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
async function homeCycles() {
  const context = await clean()
  await context.addInitScript(() => {
    const frames = new Set(),
      request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window)
    window.requestAnimationFrame = (fn) => {
      const id = request((time) => {
        frames.delete(id)
        fn(time)
      })
      frames.add(id)
      return id
    }
    window.cancelAnimationFrame = (id) => {
      frames.delete(id)
      cancel(id)
    }
    window.frameCount = () => frames.size
  })
  const p = await context.newPage()
  const requests = []
  p.on('request', (r) => {
    if (r.url().endsWith('.glb')) requests.push(r.url())
  })
  p.on('pageerror', (error) => evidence.errors.push(error.message))
  await p.goto(base + '?inspect')
  assert.equal(requests.length, 0)
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => history.replaceState(history.state, '', '?inspect'))
    const before = requests.length
    await p.locator('[data-enable]').click()
    await waitReady(p)
    await p.evaluate(() => {
      window.firstCanvas = document.querySelector('canvas')
      window.firstModel = window.__cv.inspectObject('ENV.Root')
    })
    const stats = await snapshot(p)
    await p.getByRole('link', { name: '探索小镇 →', exact: true }).click()
    await p.waitForSelector(
      '[data-route="/explore/"] .cv-root .app:not(.compact)',
    )
    const same = await p.evaluate(
      () =>
        window.firstCanvas === document.querySelector('canvas') &&
        window.firstModel === window.__cv.inspectObject('ENV.Root'),
    )
    assert.equal(same, true)
    assert.equal(requests.length - before, 1)
    assert.equal(stats.modelCount, 1)
    const resource = await p.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.glb'))
        .at(-1)
        .toJSON(),
    )
    await p.locator('.sitehead .signature').click()
    await p.waitForSelector('[data-route="/"]')
    const left = await p.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      raf: window.frameCount(),
      oldConnected: window.firstCanvas.isConnected,
      contextLost: window.firstCanvas.getContext('webgl2').isContextLost(),
    }))
    assert.deepEqual(left, {
      canvas: 0,
      raf: 0,
      oldConnected: false,
      contextLost: true,
    })
    evidence.cycles.push({
      round: i + 1,
      same,
      requests: requests.length - before,
      modelCount: stats.modelCount,
      transfer: resource.transferSize,
      encoded: resource.encodedBodySize,
      left,
    })
    // Keep the next home preview in the same instrumented browser document.
  }
  await p.goBack()
  await waitReady(p)
  await p.goForward()
  await p.waitForSelector('[data-route="/"]')
  assert.equal(await p.locator('canvas').count(), 0)
  await context.close()
}
async function fallback(kind, pattern) {
  const c = await clean(),
    p = await c.newPage(),
    requests = []
  p.on('request', (r) => {
    if (r.url().endsWith('.glb')) requests.push(r.url().split('/').at(-1))
  })
  await p.route(pattern, (route) =>
    kind === 'layout'
      ? route.fulfill({ json: { anchors: null } })
      : route.abort('failed'),
  )
  await p.goto(base + 'explore/?inspect')
  if (kind === 'meshopt' || kind === 'decoder') {
    await waitReady(p)
    assert.equal((await snapshot(p)).modelFile, 'Town.glb')
    assert.deepEqual(requests, ['Town.meshopt.glb', 'Town.glb'])
  } else {
    await p
      .locator('.loading-card strong')
      .filter({ hasText: '场景加载失败' })
      .waitFor()
    assert.equal(await p.locator('[data-static-guide]').isVisible(), true)
    assert.equal(
      await p.locator('a[href*="/projects/nexus/"]').first().isVisible(),
      true,
    )
    if (kind === 'layout') assert.ok(!requests.includes('Town.glb'))
  }
  evidence.fallback.push({ kind, requests })
  await c.close()
}
async function cancellation() {
  const c = await clean(),
    p = await c.newPage()
  let release, started
  const gate = new Promise((resolve) => (release = resolve)),
    intercepted = new Promise((resolve) => (started = resolve))
  const modelRequests = []
  p.on('request', (r) => {
    if (r.url().endsWith('.glb')) modelRequests.push(r.url())
  })
  await p.route('**/*.glb', async (route) => {
    started()
    await gate
    await route.abort().catch(() => {})
  })
  await p.goto(base + '?inspect')
  await p.locator('[data-enable]').evaluate((b) => {
    b.click()
    b.click()
  })
  await intercepted
  await p.getByRole('link', { name: '探索小镇 →', exact: true }).click()
  await p.waitForSelector('[data-route="/explore/"] .cv-root')
  await p.locator('.sitehead .signature').click()
  await p.waitForSelector('[data-route="/"]')
  release()
  await p.waitForTimeout(400)
  assert.equal(await p.locator('canvas').count(), 0)
  assert.equal(modelRequests.length, 1)
  evidence.races.push({
    case: 'double click + promote while loading + leave before completion',
    modelRequests: modelRequests.length,
    canvasAfter: 0,
  })
  await c.close()
}
async function navigation() {
  const c = await clean(),
    p = await c.newPage()
  await p.goto(base + 'explore/?inspect&place=FO')
  await waitReady(p)
  await p.waitForFunction(
    () =>
      window.__cv?.snapshot().selected === 'FO' &&
      !window.__cv.snapshot().moving,
  )
  await p.getByLabel('切换昼夜').click()
  const canvas = p.locator('canvas')
  const rect = await canvas.boundingBox()
  await p.mouse.move(rect.x + rect.width * 0.56, rect.y + rect.height * 0.52)
  await p.mouse.down()
  await p.mouse.move(rect.x + rect.width * 0.63, rect.y + rect.height * 0.55, {
    steps: 12,
  })
  await p.mouse.up()
  await p.waitForTimeout(700)
  const before = await snapshot(p)
  await p
    .locator('.sitehead nav')
    .first()
    .getByText('工作室', { exact: true })
    .click()
  await p.goto(base + 'explore/?inspect')
  await waitReady(p)
  await p.waitForFunction(
    () =>
      window.__cv?.snapshot().selected === 'FO' &&
      !window.__cv.snapshot().moving,
  )
  await p.waitForTimeout(150)
  const after = await snapshot(p)
  assert.equal(after.theme, 'night')
  assert.ok(
    before.camera.every((n, i) => Math.abs(n - after.camera[i]) < 0.04),
    JSON.stringify([before.camera, after.camera]),
  )
  evidence.bookmarks = {
    place: after.selected,
    theme: after.theme,
    before: before.camera,
    after: after.camera,
  }
  await p.goto(base + 'explore/?inspect&place=ST&hotspot=Frostwick')
  await waitReady(p)
  await p.waitForFunction(() => window.__cv?.snapshot().view === 'globe')
  await p.goto(base + 'explore/?inspect&chapter=chat&scenario=lost')
  await waitReady(p)
  assert.equal((await snapshot(p)).chat, undefined)
  assert.equal(await p.locator('.journey-launch select').inputValue(), 'lost')
  await p.reload()
  await waitReady(p)
  assert.equal((await snapshot(p)).chat, undefined)
  await c.close()
}
async function mobile() {
  const c = await browser.newContext({
    ...devices['iPhone 13'],
    defaultBrowserType: undefined,
    reducedMotion: 'reduce',
  })
  const p = await c.newPage()
  await p.goto(base)
  assert.equal(await p.locator('canvas').count(), 0)
  await p.goto(base + 'explore/?inspect&chapter=chat')
  await waitReady(p)
  const canvas = p.locator('canvas')
  assert.equal(
    await canvas.evaluate((e) => getComputedStyle(e).pointerEvents),
    'none',
  )
  await p.getByRole('button', { name: '开始操控' }).click()
  assert.notEqual(
    await canvas.evaluate((e) => getComputedStyle(e).pointerEvents),
    'none',
  )
  await p.getByRole('button', { name: '结束操控' }).click()
  await p.getByRole('button', { name: '分步播放', exact: true }).click()
  const before = (await snapshot(p)).chat
  await p.getByRole('button', { name: '坐席工作台', exact: true }).click()
  assert.equal(await p.locator('[data-staff]').isVisible(), true)
  assert.equal(await p.locator('[data-client]').isVisible(), false)
  const after = (await snapshot(p)).chat
  for (const key of [
    'step',
    'index',
    'clientRead',
    'staffRead',
    'counterpartRead',
    'fraction',
  ])
    assert.deepEqual(before[key], after[key])
  evidence.mobile = {
    side: 'staff',
    step: after.step,
    clientRead: after.clientRead,
    staffRead: after.staffRead,
    touchReleased: await canvas.evaluate(
      (e) => getComputedStyle(e).pointerEvents === 'none',
    ),
    overflow: await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }
  assert.equal(evidence.mobile.overflow, false)
  await c.close()
}
try {
  await homeCycles()
  console.log('10 promotions and releases')
  await cancellation()
  console.log('cancellation')
  for (const [kind, pattern] of [
    ['meshopt', '**/Town.meshopt.glb'],
    ['decoder', '**/meshopt_decoder*.js'],
    ['models', '**/*.glb'],
    ['layout', '**/layout.json'],
  ])
    await fallback(kind, pattern)
  await navigation()
  await mobile()
  assert.deepEqual(evidence.errors, [])
  evidence.passed = true
} finally {
  await writeFile(
    new URL('lifecycle.json', out),
    JSON.stringify(evidence, null, 2),
  )
  await browser.close()
}
