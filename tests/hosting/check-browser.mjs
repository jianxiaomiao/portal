import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.PORTAL_PREVIEW_ORIGIN || 'http://127.0.0.1:4398';
const out = new URL('../../reports/hosting/', import.meta.url);
const routes = ['', 'projects/nexus/', 'projects/flowops/', 'projects/newcrisp/', 'explore/', 'systems/', 'studio/', 'creative/'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-webgl'] });
const evidence = { browser: browser.version(), origin, prefixes: [] };
const noGpu = /(?:\.glb(?:\?|$)|\/[^/]*(?:meshopt_decoder|GLTFLoader|three[-.]|mount-)[^/]*\.js)/i;

async function noScript(base, name) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const network = [];
  const uniqueLinks = new Set();
  const result = { routes: [], links: 0, visitedProject: '', historyReturnedTo: '', modelRequests: [] };
  page.on('request', request => network.push(request.url()));
  try {
    for (const relative of routes) {
      const url = new URL(relative, base);
      const response = await page.goto(url.href);
      assert.equal(response.status(), 200);
      const h1 = page.locator('h1').first();
      assert.ok(await h1.isVisible(), url.href);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile overflow: ' + url.href);
      if (relative === 'systems/') {
        const chapters = page.locator('article.chapterarticle');
        assert.equal(await chapters.count(), 3);
        result.chapterGuides = [];
        for (const chapter of await chapters.all()) {
          await chapter.locator('summary').click();
          const steps = await chapter.locator('ol li').allInnerTexts();
          assert.ok(steps.length >= 3 && steps.every(step => step.trim().length));
          const img = chapter.locator('details img');
          await img.scrollIntoViewIfNeeded();
          await img.evaluate(node => node.decode());
          assert.ok(await img.isVisible());
          result.chapterGuides.push({ title: await chapter.locator('h2').innerText(), steps: steps.length,
            sourceImage: await img.getAttribute('src') });
        }
      }
      const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(a => a.href));
      for (const href of links) {
        const link = new URL(href);
        if (link.origin === base.origin) {
          assert.ok(link.pathname.startsWith(base.pathname), 'link escaped site prefix: ' + href);
          uniqueLinks.add(link.origin + link.pathname + link.search);
        }
      }
      const refreshed = await page.reload();
      assert.equal(refreshed.status(), 200);
      assert.ok(await h1.isVisible());
      result.routes.push({ path: url.pathname, heading: await h1.innerText(), links: links.length, refreshed: refreshed.status() });
    }
    for (const url of uniqueLinks) {
      const response = await context.request.get(url);
      assert.equal(response.status(), 200, url);
      await response.dispose();
    }
    result.links = uniqueLinks.size;
    await page.goto(base.href);
    for (const id of ['projects', 'ecosystem', 'stack', 'top']) {
      assert.equal(await page.locator('#' + id).count(), 1, 'missing compatibility anchor: ' + id);
    }
    await page.screenshot({ path: new URL(name + '-no-js.png', out).pathname });
    const projectUrl = new URL('projects/nexus/', base);
    await page.locator('a[href]').filter({ hasText: /Nexus/i }).first().click();
    assert.equal(new URL(page.url()).pathname, projectUrl.pathname);
    result.visitedProject = page.url();
    await page.goBack();
    result.historyReturnedTo = page.url();
    assert.equal(new URL(page.url()).pathname, base.pathname);
    result.modelRequests = network.filter(url => noGpu.test(url));
    assert.deepEqual(result.modelRequests, []);
    return result;
  } finally {
    await context.close();
  }
}

async function ordinaryPagesAndFallback(base, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const traffic = [];
  const exceptions = [];
  const missing = [];
  page.on('request', req => traffic.push(req.url()));
  page.on('pageerror', err => exceptions.push(err.message));
  page.on('response', res => { if (res.status() >= 400) missing.push([res.status(), res.url()]); });
  try {
    for (const relative of routes.filter(route => route !== 'explore/')) {
      await page.goto(new URL(relative, base).href, { waitUntil: 'networkidle' });
      assert.ok(await page.locator('h1').first().isVisible());
    }
    const ordinaryModelRequests = traffic.filter(url => noGpu.test(url));
    const ordinaryScripts = [...new Set(traffic.filter(url => new URL(url).pathname.endsWith('.js')))];
    assert.deepEqual(ordinaryModelRequests, []);
    const explore = new URL('explore/?place=NC', base);
    await page.goto(explore.href, { waitUntil: 'networkidle' });
    assert.ok(await page.evaluate(() => document.createElement('canvas').getContext('webgl2') === null));
    const launch = page.locator('[data-enable]:visible').first();
    if (await launch.count()) await launch.click();
    const fallback = page.locator('.loading-card strong').filter({ hasText: '静态总览' });
    await fallback.waitFor({ timeout: 15000 });
    assert.ok(await page.locator('[data-static-guide]').isVisible(), 'static guide hidden during fallback');
    await page.screenshot({ path: new URL(name + '-no-webgl.png', out).pathname });
    const project = page.locator('a[href*="/projects/newcrisp/"]:visible').first();
    await project.click();
    assert.equal(new URL(page.url()).pathname, new URL('projects/newcrisp/', base).pathname);
    assert.deepEqual(exceptions, []);
    assert.deepEqual(missing, []);
    return {
      ordinaryModelRequests, ordinaryScripts, enabledJsPages: routes.length - 1, fallback: '静态总览',
      fallbackTarget: explore.pathname + explore.search, projectAfterFallback: page.url(),
      failedScripts: exceptions, missingResponses: missing,
      glbRequestsWithDisabledWebGL: traffic.filter(url => /\.glb(?:\?|$)/i.test(url)),
    };
  } finally {
    await context.close();
  }
}

async function verifyBrowserCache(base, folder) {
  const entries = await readdir(new URL('../../' + folder + '/', import.meta.url));
  const version = entries.find(name => /^town-[0-9a-f]{12}$/.test(name));
  assert.ok(version);
  // A fresh regular profile exercises the disk HTTP cache, including large models.
  const profile = await mkdtemp(path.join(tmpdir(), 'portal-cache-check-'));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const responses = [];
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived', event => {
      if (event.response.url.endsWith('Town.meshopt.glb')) {
        responses.push({ status: event.response.status, fromDiskCache: event.response.fromDiskCache });
      }
    });
    await page.goto(base.href);
    const url = new URL(version + '/Town.meshopt.glb', base).href;
    const samples = await page.evaluate(async url => {
      const observations = [];
      for (let i = 0; i < 2; i++) {
        const response = await fetch(url);
        const bytes = (await response.arrayBuffer()).byteLength;
        if (performance.getEntriesByName(url).length < i + 1) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => { observer.disconnect(); reject(new Error('missing Resource Timing entry')); }, 5000);
            const observer = new PerformanceObserver(() => {
              if (performance.getEntriesByName(url).length < i + 1) return;
              clearTimeout(timer); observer.disconnect(); resolve();
            });
            observer.observe({ type: 'resource', buffered: true });
          });
        }
        const timing = performance.getEntriesByName(url).at(-1);
        observations.push({ status: response.status, bytes, transfer: timing.transferSize,
          encoded: timing.encodedBodySize, durationMs: timing.duration });
      }
      return observations;
    }, url);
    assert.equal(samples[0].bytes, 7591900);
    assert.equal(samples[1].bytes, samples[0].bytes);
    assert.ok(samples[0].transfer >= samples[0].bytes);
    assert.equal(samples[1].transfer, 0, 'unchanged version should use browser cache');
    assert.equal(responses[1]?.fromDiskCache, true);
    return { url, first: samples[0], repeat: samples[1], responses };
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

try {
  await mkdir(out, { recursive: true });
  for (const [prefix, name] of [['/', 'root'], ['/portal/', 'pages']]) {
    const base = new URL(prefix, origin);
    const noJs = await noScript(base, name);
    const noWebGL = await ordinaryPagesAndFallback(base, name);
    assert.deepEqual(noWebGL.glbRequestsWithDisabledWebGL, []);
    const cache = await verifyBrowserCache(base, name === 'root' ? 'dist' : 'dist-pages');
    evidence.prefixes.push({ prefix, noJs, noWebGL, cache });
  }
  await writeFile(new URL('browser.json', out), JSON.stringify(evidence, null, 2) + '\n');
  console.log('Both prefixes passed direct navigation, reload, ordinary links and disabled JS/WebGL.');
} finally {
  await browser.close();
}
