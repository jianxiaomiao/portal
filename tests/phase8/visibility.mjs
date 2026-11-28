// Use a fresh normal Chrome profile. Playwright's default focus emulation keeps
// a background document visible; the native tab test must omit that override.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import {openChapter} from './support-chat-ui.mjs'
import { base, ready, json, sleep } from './common.mjs'
const profile = await mkdtemp(join(tmpdir(), 'codeville-tab-')),
  exe =
    process.env.CHROME_BIN ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const proc = spawn(
  exe,
  [
    '--user-data-dir=' + profile,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
let browser
try {
  let port
  for (let i = 0; i < 120 && !port; i++) {
    try {
      port = Number(
        (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(
          '\n',
        )[0],
      )
    } catch {
      await sleep(100)
    }
  }
  assert.ok(port)
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, {
    noDefaults: true,
  })
  const ctx = browser.contexts()[0],
    p = ctx.pages()[0]
  await p.goto(base + '?inspect')
  await ready(p)
  if (process.env.CHAT_VISIBILITY) await openChapter(p,'chat','normal',true)
  await p.bringToFront()
  await p.evaluate(() => {
    window.__vis = []
    document.addEventListener('visibilitychange', () =>
      window.__vis.push({
        hidden: document.hidden,
        t: performance.now(),
        phase: window.__cv.snapshot().motion.times[0],
      }),
    )
  })
  const other = await ctx.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await p.waitForFunction(() => document.hidden, null, {
    polling: 100,
    timeout: 4000,
  })
  const position = () => p.evaluate(() => {
    const state=window.__cv.snapshot().chat
    return state && [state.index,state.fraction]
  })
  const chatFrozen = await position()
  const frozen = await p.evaluate(() => window.__cv.snapshot().motion)
  await sleep(1500)
  const last = await p.evaluate(() => window.__cv.snapshot().motion)
  assert.deepEqual(last.times, frozen.times)
  assert.equal(last.active, false)
  if(process.env.CHAT_VISIBILITY) assert.deepEqual(await position(),chatFrozen)
  await p.bringToFront()
  await p.waitForTimeout(210)
  const result = await p.evaluate(() => ({
    now: window.__cv.snapshot().motion,
    events: window.__vis,
  }))
  assert.ok(
    result.now.times[0] > last.times[0] &&
      result.now.times[0] - last.times[0] < 0.6,
  )
  assert.deepEqual(result.events.map((e) => e.hidden).slice(-2), [true, false])
  const chatResumed = await position()
  if(process.env.CHAT_VISIBILITY) {
    assert.equal(chatResumed[0],chatFrozen[0])
    assert.ok(chatResumed[1]>chatFrozen[1] && chatResumed[1]-chatFrozen[1]<.22)
  }
  await json(process.env.CHAT_VISIBILITY ? 'chat-visibility.json' : 'visibility.json', {
    chatFrozen,chatResumed,
    realTabs: true,
    hiddenSampleMs: 1500,
    frozen,
    last,
    ...result,
  })
  console.log('PASS native tab', result.events)
} finally {
  await browser?.close()
  proc.kill('SIGTERM')
  await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(1500)])
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 150,
  })
}
