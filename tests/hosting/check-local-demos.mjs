import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { chromium } from 'playwright'

const origin = new URL(process.env.PORTAL_PREVIEW_ORIGIN || 'http://127.0.0.1:4398')
const root = 'dist-pages'
const allowed = new Set()
for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const path = '/portal/' + relative(root, join(entry.parentPath, entry.name))
  allowed.add(path)
  if (path.endsWith('/index.html')) allowed.add(path.slice(0, -10))
}
const browser = await chromium.launch({ channel: 'chrome' })
const summary = { browser: browser.version(), requests: 0, chapters: {}, unexpected: [] }
try {
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue()
    if (url.origin !== origin.origin || !allowed.has(url.pathname) || request.method() !== 'GET') {
      summary.unexpected.push([request.method(), url.origin, url.pathname])
      return route.abort()
    }
    summary.requests++
    return route.continue()
  })
  await context.routeWebSocket('**/*', socket => {
    summary.unexpected.push(['WebSocket', new URL(socket.url()).pathname])
    socket.close()
  })
  const page = await context.newPage()
  await page.goto(new URL('/portal/', origin).href)
  assert.equal(await page.locator('canvas').count(), 0)
  for (const chapter of ['api', 'ticket', 'chat']) {
    await page.goto(new URL('/portal/explore/?inspect&chapter=' + chapter, origin).href)
    await page.waitForSelector('[data-stage=ready]')
    assert.equal(await page.evaluate(() => typeof window.__cv), 'undefined')
    await page.getByRole('button', { name: '分步播放', exact: true }).click()
    const next = page.getByRole('button', { name: '下一步', exact: true })
    await next.waitFor()
    let steps = 0
    while (await next.isVisible()) {
      assert.ok(steps < 100, chapter)
      await next.click()
      steps++
    }
    assert.ok(steps > 4, chapter)
    summary.chapters[chapter] = steps
  }
  assert.deepEqual(summary.unexpected, [])
  console.log(JSON.stringify(summary, null, 2))
} finally {
  await browser.close()
}
