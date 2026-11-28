import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { cp, mkdir, mkdtemp, appendFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const project = fileURLToPath(new URL('../../', import.meta.url))
const work = await mkdtemp(join(tmpdir(), 'portal-release-'))
const original = join(project, 'dist')
const fixture = join(work, 'fixture')
const candidate = join(fixture, 'dist')
let active = original
const findTown = async (directory) => (await readdir(directory)).find((item) => item.startsWith('town-'))
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }
const host = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname
  const html = relative.endsWith('.html')
  // Each publish swaps HTML atomically. Prior versioned files stay available to old tabs.
  for (const root of html ? [active] : [active, active === original ? candidate : original]) {
    const file = join(root, relative)
    try {
      const info = await stat(file)
      if (!info.isFile()) continue
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': html ? 'no-cache' : 'public,max-age=31536000,immutable' })
      createReadStream(file).pipe(res)
      return
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  res.writeHead(404).end()
})
const rows = []
let browser
try {
  await mkdir(fixture)
  for (const path of ['src','public','scripts','index.html','vite.config.ts','tsconfig.json','package.json'])
    await cp(join(project, path), join(fixture, path), { recursive:true })
  await symlink(join(project, 'node_modules'), join(fixture, 'node_modules'), 'dir')
  // A semantically identical JSON fixture exercises a real content-version change.
  await appendFile(join(fixture, 'src/codeville/resources/layout.json'), '\n')
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture, env: { ...process.env, PORTAL_BASE:'/', PORTAL_OUT:'dist', PORTAL_INSPECT:'0' }, stdio:'pipe' })
  const oldVersion = await findTown(original), nextVersion = await findTown(candidate)
  assert.notEqual(nextVersion, oldVersion)
  await new Promise((ok) => host.listen(0, '127.0.0.1', ok))
  const base = 'http://127.0.0.1:' + host.address().port + '/'
  browser = await chromium.launchPersistentContext(join(work,'profile'), { channel:'chrome', headless:true, reducedMotion:'reduce', viewport:{width:1440,height:900} })
  const page = await browser.newPage()
  const cdp = await browser.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline:false, latency:80, downloadThroughput:10e6/8, uploadThroughput:5e6/8 })
  const ready = () => page.waitForSelector('[data-stage=ready]', { timeout:90000 })
  const verify = async (kind, version, action) => {
    await page.evaluate(() => performance.clearResourceTimings())
    const clock = await page.evaluate(() => performance.timeOrigin + performance.now())
    await action()
    await ready()
    const result = await page.evaluate(() => ({
      readyAt:performance.timeOrigin+performance.now(),
      files:performance.getEntriesByType('resource').filter((r)=>/\/(Town\.meshopt\.glb|layout\.json)$/.test(r.name)).map((r)=>({path:new URL(r.name).pathname, transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),
    }))
    if (kind === 'promotion') assert.equal(result.files.length,0)
    else {
      assert.equal(result.files.length,2)
      assert.ok(result.files.every((f)=>f.path.startsWith('/'+version+'/')))
    }
    rows.push({ kind, version, elapsedMs:Math.round(result.readyAt-clock), files:result.files })
  }
  await page.goto(base)
  active = candidate
  await verify('old-tab-after-upgrade', oldVersion, () => page.locator('[data-enable]').click())
  await page.goto(base)
  await verify('new-tab-after-upgrade', nextVersion, () => page.locator('[data-enable]').click())
  const returnHome = async () => {
    await page.locator('.sitehead .signature').click()
    await page.waitForSelector('[data-route="/"] [data-enable]')
  }
  for (let i=0;i<3;i++) {
    await verify('promotion', nextVersion, async () => {
      await page.getByRole('link',{name:'探索小镇 →',exact:true}).click()
      await page.waitForSelector('[data-route="/explore/"] .app:not(.compact)')
    })
    await returnHome()
    await verify('reentry',nextVersion,()=>page.locator('[data-enable]').click())
    await page.goto(base)
    await verify('warm-page',nextVersion,()=>page.locator('[data-enable]').click())
  }
  active = original
  await page.goto(base)
  await verify('after-rollback',oldVersion,()=>page.locator('[data-enable]').click())
  const timings = {}
  for (const kind of ['promotion','reentry','warm-page']) {
    const group = rows.filter((r)=>r.kind===kind)
    const ms = group.map((r)=>r.elapsedMs).sort((a,b)=>a-b)
    timings[kind]={ minMs:ms[0],medianMs:ms[1],maxMs:ms[2] }
    if (kind !== 'promotion') assert.ok(group.every((r)=>r.files.every((f)=>f.transferSize===0)))
  }
  await writeFile(join(project,'reports/hosting/release-switch.json'),JSON.stringify({ browser:browser.browser().version(),oldVersion,nextVersion,timings,rows },null,2)+'\n')
  console.log(timings)
} finally {
  await browser?.close()
  if (host.listening) await new Promise((ok)=>host.close(ok))
  await rm(work,{recursive:true,force:true})
}
