import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.PORTAL_PREVIEW_ORIGIN || 'http://127.0.0.1:4398';
const out = new URL('../../reports/hosting/', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const prefix of ['/', '/portal/']) {
    for (const model of ['meshopt', 'raw']) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        const observed = [];
        const errors = [];
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.origin !== origin) errors.push('unexpected origin: ' + url.origin);
          if (url.protocol === 'blob:') return; // Embedded glTF texture, no HTTP request.
          if (!url.pathname.startsWith(prefix)) errors.push('incorrect base: ' + url.pathname);
          if (response.status() >= 400) errors.push(response.status() + ' ' + url.pathname);
          observed.push(url.pathname);
        });
        page.on('pageerror', error => errors.push(error.message));
        const url = new URL('explore/?place=NC' + (model === 'raw' ? '&model=raw' : ''), new URL(prefix, origin));
        const response = await page.goto(url.href);
        assert.equal(response.status(), 200);
        await page.waitForSelector('.cv-root [data-stage="ready"]', { timeout: 60000 });
        const enabled = await page.locator('canvas[data-map]').isVisible();
        assert.ok(enabled);
        assert.equal(await page.evaluate(() => typeof window.__cv), 'undefined');
        const expected = model === 'raw' ? 'Town.glb' : 'Town.meshopt.glb';
        assert.deepEqual(observed.filter(path => path.endsWith('.glb')).map(path => path.split('/').at(-1)), [expected]);
        const layout = observed.filter(path => path.endsWith('/layout.json'));
        assert.equal(layout.length, 1);
        const decoder = observed.filter(path => path.includes('meshopt_decoder'));
        assert.equal(decoder.length, model === 'raw' ? 0 : 1);
        const three = observed.filter(path => /\/three-[\w-]+\.js$/.test(path));
        assert.equal(three.length, 1);
        assert.deepEqual(errors, []);
        results.push({ prefix, model, url: url.href, httpStatus: response.status(), layout,
          modelUrl: observed.find(path => path.endsWith('.glb')), three, decoder, visibleCanvas: enabled, errors });
      } finally {
        await context.close();
      }
    }
  }
  await mkdir(out, { recursive: true });
  await writeFile(new URL('model-paths.json', out), JSON.stringify({ browser: browser.version(), results }, null, 2) + '\n');
  console.log('WebGL ready in both builds with Meshopt and raw models.');
} finally {
  await browser.close();
}
