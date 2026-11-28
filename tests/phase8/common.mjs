import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
export const base = process.env.CODEVILLE_URL || 'http://127.0.0.1:4399/explore/'
export const out = new URL('../../reports/phase8/', import.meta.url)
export const file = (n) => fileURLToPath(new URL(n, out))
export const chromeOptions = { channel: 'chrome', headless: process.env.HEADLESS !== '0' }
export const desktop = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const snap = (p) => p.evaluate(() => window.__cv.snapshot())
export const ready = async (p) => {
  await p.waitForFunction(
    () =>
      !!window.__cv ||
      ['场景加载失败', '静态总览'].includes(
        document.querySelector('.loading-card strong')?.textContent,
      ),
    null,
    { timeout: 90000 },
  )
  if (!(await p.evaluate(() => !!window.__cv)))
    throw Error(await p.locator('.loading-card').innerText())
  await p.waitForFunction(() => window.__cv?.snapshot().fps > 0)
}
export const settle = async (p) => {
  await p.waitForFunction(() => !window.__cv.snapshot().moving)
  await p.waitForTimeout(220)
}
export async function start(p) {
  await p.goto(base + '?inspect')
  await ready(p)
  await settle(p)
}
export async function home(p) {
  await p.getByRole('button', { name: '返回总览', exact: true }).click()
  await settle(p)
}
export async function change(p, key) {
  const s = await snap(p)
  if (!s.selected) await p.locator('[data-place="' + key + '"]').click()
  else await p.getByLabel('切换地点').selectOption(key)
  await settle(p)
}
export async function capture(p, name) {
  await mkdir(file('screenshots'), { recursive: true })
  await p.screenshot({ path: file('screenshots/' + name + '.png') })
}
export async function physical(p, id) {
  const b = await p.locator('[data-map]').boundingBox()
  const pos = await p.evaluate((id) => {
    const cv = window.__cv,
      origin = cv.project(
        id === 'hub' ? 'ENV.Anchor.Focus' : id + '.Anchor.Pick',
      )
    for (const radius of [0, 5, 10, 18, 28, 38, 52, 70])
      for (let i = 0; i < 12; i++) {
        const x = origin.x + radius * Math.cos((i * Math.PI) / 6),
          y = origin.y + radius * Math.sin((i * Math.PI) / 6)
        if (cv.hit(x, y) === id) return { x, y }
      }
    return null
  }, id)
  assert.ok(pos, 'actual visible geometry for ' + id)
  return { x: b.x + pos.x, y: b.y + pos.y }
}
export async function json(name, data) {
  await mkdir(out, { recursive: true })
  await writeFile(file(name), JSON.stringify(data, null, 2) + '\n')
}
