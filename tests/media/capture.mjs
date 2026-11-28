import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = new URL(process.env.PORTAL_URL || 'http://127.0.0.1:4398/')
if (!base.pathname.endsWith('/')) throw Error('PORTAL_URL must end with a slash')
const out = fileURLToPath(new URL('../../reports/media/', import.meta.url))
const recordings = await mkdtemp(join(tmpdir(), 'portal-capture-'))
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN' }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { browser: browser.version(), base: base.href, screenshots: [], videos: [], errors: [] }
const button = (page, name) => page.getByRole('button', { name, exact: true })
await mkdir(out, { recursive: true })

async function fresh(options = {}) {
  const context = await browser.newContext({ ...desktop, ...options })
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  page.on('pageerror', error => report.errors.push(error.message))
  return { context, page }
}
async function visit(page, path) {
  const response = await page.goto(new URL(path, base).href)
  assert.equal(response?.status(), 200, path)
  await page.evaluate(() => document.fonts.ready)
}
async function capture(page, name, { fullPage = false, detail } = {}) {
  // Visit offscreen images as a reader would, before exporting the full page.
  if (fullPage) {
    for (const image of await page.locator('img:visible').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(el => el.decode())
    }
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.mouse.move(1, 1)
  const img = await page.screenshot({ path: join(out, name), fullPage })
  report.screenshots.push({ name, title: await page.title(), path: new URL(page.url()).pathname,
    width: img.readUInt32BE(16), height: img.readUInt32BE(20), bytes: img.length, detail })
  console.log('截图', name)
}
async function enterScene(page) {
  await page.locator('.cv-root [data-stage="ready"]').waitFor({ state: 'attached', timeout: 90000 })
  await page.locator('canvas[data-map]').waitFor({ state: 'visible' })
}
async function clickExplore(page, target) {
  // Inspect actual rendered anchors so root and Pages-prefix builds use the same script.
  const links = page.getByRole('link')
  const url = new URL('explore/', base)
  for (const anchor of await links.all()) {
    const href = await anchor.getAttribute('href')
    if (!href) continue
    const actual = new URL(href, page.url())
    if (actual.pathname !== url.pathname) continue
    if (!Object.entries(target).every(([key, value]) => actual.searchParams.get(key) === value)) continue
    await anchor.scrollIntoViewIfNeeded()
    await page.waitForTimeout(350)
    await anchor.click()
    await page.waitForURL(location => location.pathname === url.pathname)
    return
  }
  throw Error('没有匹配的探索入口 ' + JSON.stringify(target) + ' on ' + page.url())
}
async function captureStatic() {
  const { context, page } = await fresh()
  const modelRequests = []
  page.on('request', request => { if (/\.glb(?:$|\?)/.test(request.url())) modelRequests.push(request.url()) })
  try {
    await visit(page, './')
    await capture(page, 'home-desktop.png')
    await capture(page, 'home-desktop-full.png', { fullPage: true })
    for (const path of ['projects/nexus/', 'projects/flowops/', 'projects/newcrisp/', 'systems/', 'studio/', 'creative/']) {
      await visit(page, path)
      await capture(page, path.slice(0, -1).replaceAll('/', '-') + '.png', { fullPage: true })
    }
    assert.deepEqual(modelRequests, [])
  } finally { await context.close() }
  const phone = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    await visit(phone.page, './')
    assert.equal(await phone.page.locator('canvas').count(), 0)
    assert.ok(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await capture(phone.page, 'home-mobile-full.png', { fullPage: true })
  } finally { await phone.context.close() }
}
async function captureScenes() {
  const { context, page } = await fresh({ reducedMotion: 'reduce' })
  try {
    await visit(page, 'explore/')
    await enterScene(page)
    await capture(page, 'explore.png')
    const shots = [
      ['api', '在请求线程计算 SHA256'],
      ['ticket', 'FlowOps 提交成功'],
      ['chat', '客户窗口出现回复'],
    ]
    for (const [chapter, cue] of shots) {
      await visit(page, 'systems/')
      await clickExplore(page, { chapter })
      await enterScene(page)
      await button(page, '分步播放').click()
      const heading = page.getByRole('heading', { name: cue, exact: true })
      for (let step = 0; !(await heading.count()); step++) {
        assert.ok(step < 60, '未到达原剧情分镜：' + cue)
        await button(page, '下一步').click()
      }
      await heading.waitFor()
      await page.locator('.workspace aside').evaluate(el => { el.scrollTop = 0 })
      await page.waitForTimeout(300)
      await capture(page, 'chapter-' + chapter + '.png', { detail: cue })
    }
  } finally { await context.close() }
}
async function record(name, action) {
  const { page, context } = await fresh({ recordVideo: { dir: recordings, size: desktop.viewport } })
  const video = page.video()
  try {
    await action(page)
    await page.waitForTimeout(1000)
  } finally { await context.close() }
  await video.saveAs(join(out, name))
  await video.delete()
  console.log('录屏', name)
}
async function previewTour(page) {
  await visit(page, './')
  await page.waitForTimeout(1200)
  await page.locator('[data-enable]:visible').first().click()
  await enterScene(page)
  const canvas = page.locator('canvas[data-map]')
  await capture(page, 'home-preview.png', { detail: '主动启用后的实时全镇总览' })
  const bounds = await canvas.boundingBox()
  const host = await page.locator('.world-frame').boundingBox()
  assert.ok(bounds && host, '首页预览必须有可见的宿主和画布')
  assert.ok(Math.abs(bounds.width - host.width) <= 2 && Math.abs(bounds.height - host.height) <= 2,
    '实时画布与首页展示区域不一致')
  report.preview = { canvas: bounds, host, originalPoster: [1800, 1238] }
  const x = bounds.x + bounds.width * 0.57
  const y = bounds.y + bounds.height * 0.50
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 60, y + 10, { steps: 22 })
  await page.mouse.up()
  await page.waitForTimeout(750)
  await clickExplore(page, {})
  await enterScene(page)
  await page.locator('[data-place="NX"]').click()
  await page.getByLabel('切换地点').waitFor()
  await page.waitForTimeout(1400)
}
async function deepLinkTour(page) {
  const stops = [
    ['projects/flowops/', { place: 'FO' }, '.place-name', 'FlowOps'],
    ['studio/', { hotspot: 'Books' }, '.hot-info b', '技术栈'],
    ['creative/', { hotspot: 'Frostwick' }, '.view-chip', '收藏品特写'],
    ['systems/', { chapter: 'chat' }, '.journey-launch', '分步播放'],
  ]
  for (const [origin, target, selector, cue] of stops) {
    await visit(page, origin)
    await page.waitForTimeout(650)
    await clickExplore(page, target)
    await enterScene(page)
    await page.locator(selector).filter({ hasText: cue }).first().waitFor()
    await page.waitForTimeout(1500)
  }
}
async function decode(page, name) {
  const buffer = await readFile(join(out, name))
  await page.setContent('<video muted preload="auto"></video>')
  const sample = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
    const video = document.querySelector('video')
    const ready = new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true })
      video.addEventListener('error', reject, { once: true })
    })
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }))
    try {
      video.src = url
      await ready
      const duration = video.duration
      if (!Number.isFinite(duration) || duration < 2) throw Error('无有效录屏时长')
      const frame = document.createElement('canvas')
      frame.width = 64
      frame.height = 40
      const ctx = frame.getContext('2d', { willReadFrequently: true })
      const samples = []
      for (const fraction of [0.16, 0.5, 0.86]) {
        const sought = new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }))
        video.currentTime = duration * fraction
        await sought
        ctx.drawImage(video, 0, 0, 64, 40)
        const rgba = ctx.getImageData(0, 0, 64, 40).data
        const colors = new Set()
        let hash = 2166136261
        for (let offset = 0; offset < rgba.length; offset += 4) {
          colors.add((rgba[offset] << 16) + (rgba[offset + 1] << 8) + rgba[offset + 2])
          hash = Math.imul(hash ^ rgba[offset], 16777619)
        }
        samples.push({ seconds: +video.currentTime.toFixed(2), colors: colors.size, hash: hash >>> 0 })
      }
      return { duration: +duration.toFixed(2), width: video.videoWidth, height: video.videoHeight, samples }
    } finally { URL.revokeObjectURL(url) }
  }, buffer.toString('base64'))
  assert.ok(sample.samples.every(frame => frame.colors > 30))
  assert.ok(new Set(sample.samples.map(frame => frame.hash)).size > 1)
  report.videos.push({ name, bytes: (await stat(join(out, name))).size, ...sample })
}

try {
  await captureStatic()
  await captureScenes()
  await record('home-preview-explore.webm', previewTour)
  await record('deep-links.webm', deepLinkTour)
  const verifier = await browser.newPage()
  for (const name of ['home-preview-explore.webm', 'deep-links.webm']) await decode(verifier, name)
  await verifier.close()
  assert.deepEqual(report.errors, [])
  report.passed = true
} finally {
  await writeFile(join(out, 'capture.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  await rm(recordings, { recursive: true, force: true })
}
