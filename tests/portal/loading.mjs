import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4399/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = {
  browser: browser.version(),
  downMbit: 10,
  upMbit: 5,
  latencyMs: 80,
  samples: [],
  medians: {},
}
const out = new URL('../../reports/integration/', import.meta.url)
await mkdir(out, { recursive: true })
try {
  for (let round = 0; round < 3; round++)
    for (const model of round % 2 ? ['raw', 'meshopt'] : ['meshopt', 'raw']) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      try {
        const p = await ctx.newPage()
        const cdp = await ctx.newCDPSession(p)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 80,
          downloadThroughput: 10e6 / 8,
          uploadThroughput: 5e6 / 8,
        })
        await p.addInitScript(() => {
          const observer = new MutationObserver(() => {
            if (
              document.querySelector('h1') &&
              document.querySelector('.sitehead nav a') &&
              !window.htmlReady
            )
              window.htmlReady = performance.now()
            const stage = document.querySelector(
              '.loading-card strong',
            )?.textContent
            if (stage && window.phases.at(-1)?.name !== stage)
              window.phases.push({
                name: stage.trim(),
                ms: Math.round(performance.now()),
              })
          })
          window.phases = []
          observer.observe(document, {
            subtree: true,
            childList: true,
            characterData: true,
          })
        })
        await p.goto(base + '?inspect&model=' + model)
        const before = await p.evaluate(
          () =>
            performance
              .getEntriesByType('resource')
              .filter((r) => r.name.endsWith('.glb')).length,
        )
        assert.equal(before, 0)
        await p.locator('[data-enable]').evaluate((b) => {
          window.activation = performance.now()
          b.click()
        })
        await p.waitForFunction(
          () => window.__cv?.snapshot().modelCount === 1,
          null,
          { timeout: 90000 },
        )
        const record = await p.evaluate(() => {
          const {
            readyMs,
            downloadMs,
            parseMs,
            firstRenderMs,
            modelFile,
            bytes,
          } = window.__cv.snapshot()
          return {
            modelFile,
            bytes,
            htmlMs: window.htmlReady,
            firstContentfulPaintMs: performance.getEntriesByName(
              'first-contentful-paint',
            )[0]?.startTime,
            clickToReadyMs: readyMs - window.activation,
            downloadMs,
            parseMs,
            firstRenderMs,
            phases: window.phases,
            transfers: performance
              .getEntriesByType('resource')
              .filter(
                (r) =>
                  r.name.endsWith('.glb') || r.name.includes('meshopt_decoder'),
              )
              .map((r) => ({
                file: r.name.split('/').at(-1),
                encoded: r.encodedBodySize,
                transfer: r.transferSize,
              })),
          }
        })
        report.samples.push({ round: round + 1, model, ...record })
        console.log(model, Math.round(record.clickToReadyMs))
      } finally {
        await ctx.close()
      }
    }
  for (const model of ['raw', 'meshopt']) {
    const times = report.samples
      .filter((s) => s.model === model)
      .map((s) => s.clickToReadyMs)
      .sort((a, b) => a - b)
    report.medians[model] = {
      minMs: times[0],
      medianMs: times[1],
      maxMs: times[2],
    }
  }
} finally {
  await writeFile(new URL('loading.json', out), JSON.stringify(report, null, 2))
  await browser.close()
}
