import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(new URL('explore/?inspect&view=home', base).href)
  await page.waitForFunction(() => window.__cv?.snapshot().fps > 0 && !window.__cv.snapshot().moving)
  const canvas = page.locator('canvas[data-map]')
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  await page.evaluate(() => {
    const dial = document.querySelector('.compass')
    const card = dial.querySelector('.card')
    const north = dial.querySelector('.north')
    const samples = []
    function record() {
      const { camera, target } = window.__cv.snapshot()
      const expected = Math.atan2(camera[0] - target[0], camera[2] - target[2])
      const transform = new DOMMatrix(getComputedStyle(card).transform)
      const delta = Math.atan2(transform.b, transform.a) - expected
      const letter = north.getScreenCTM()
      samples.push({
        expected,
        bearing: parseFloat(dial.style.getPropertyValue('--bearing')),
        error: Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))),
        tilt: Math.abs(Math.atan2(letter.b, letter.a)),
      })
      frame = requestAnimationFrame(record)
    }
    let frame = requestAnimationFrame(record)
    window.endCompassSample = () => {
      cancelAnimationFrame(frame)
      return samples
    }
  })
  for (const direction of [1, 1, -1, -1]) {
    const x = box.x + box.width * (direction > 0 ? 0.2 : 0.8)
    const y = box.y + box.height * 0.56
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + direction * box.width * 0.6, y, { steps: 38 })
    await page.mouse.up()
    await page.waitForTimeout(550)
  }
  for (const name of ['鸟瞰', '反向']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.waitForFunction(() => !window.__cv.snapshot().moving)
  }
  const samples = await page.evaluate(() => window.endCompassSample())
  let seams = 0
  for (let i = 1; i < samples.length; i++) {
    const now = samples[i], previous = samples[i - 1]
    assert.ok(now.error < Math.PI / 180, 'north must follow the horizontal camera heading')
    assert.ok(now.tilt < 0.001, 'cardinal labels must remain upright')
    if (Math.abs(now.expected - previous.expected) > Math.PI) {
      seams++
      assert.ok(Math.abs(now.bearing - previous.bearing) <= Math.PI, 'crossing the angular seam takes the short arc')
    }
  }
  assert.ok(seams >= 2)
  console.log('Compass follows manual orbit and camera flights through', seams, 'angular seams')
} finally {
  await browser.close()
}
