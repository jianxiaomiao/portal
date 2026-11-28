import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const origin = process.env.PORTAL_PREVIEW_ORIGIN || 'http://127.0.0.1:4398';
const reportDir = path.join(repo, 'reports', 'hosting');
const routeNames = ['', 'projects/nexus/', 'projects/flowops/', 'projects/newcrisp/', 'explore/', 'systems/', 'studio/', 'creative/'];
const builds = [['/', 'dist'], ['/portal/', 'dist-pages']];
const mime = {
  '.css': 'text/css', '.glb': 'model/gltf-binary', '.html': 'text/html', '.js': 'application/javascript',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png',
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }));
  return files.flat().sort();
}

await mkdir(reportDir, { recursive: true });
const results = [];
for (const [prefix, folder] of builds) {
  const base = new URL(prefix, origin);
  const buildDir = path.join(repo, folder);
  const files = await filesIn(buildDir);
  const summary = { prefix, folder, routes: [], files: [], missing: [], server: null };
  results.push(summary);

  for (const file of files) {
    const relative = path.relative(buildDir, file);
    const url = new URL(relative, base);
    const http = await fetch(url);
    assert.equal(http.status, 200, url.href);
    const bytes = Buffer.from(await http.arrayBuffer());
    assert.ok(bytes.equals(await readFile(file)), 'dist and HTTP differ: ' + url.href);
    const type = path.extname(file);
    const headers = Object.fromEntries(http.headers);
    if (mime[type]) assert.ok(headers['content-type']?.startsWith(mime[type]), url.href);
    if (['.html', '.css', '.js', '.json'].includes(type)) {
      assert.doesNotMatch(bytes.toString(), /\/Users\/xiaomiao\/|\/private\/tmp\/portal-/, relative);
    }
    const versioned = /^(?:assets\/|(?:media|town)-[0-9a-f]{12}\/)/.test(relative);
    if (versioned) assert.match(headers['cache-control'] || '', /immutable/, url.href);
    if (type === '.html') assert.match(headers['cache-control'] || '', /no-cache/, url.href);
    const etag = headers.etag;
    assert.ok(etag, url.href);
    const conditional = await fetch(url, { headers: { 'If-None-Match': etag } });
    assert.equal(conditional.status, 304, url.href);
    await conditional.arrayBuffer();
    summary.files.push({ relative, size: bytes.length, sha256: sha256(bytes), type: headers['content-type'], cache: headers['cache-control'], etag, conditional: conditional.status });
  }
  assert.equal(summary.files.filter(f => f.relative.endsWith('.glb')).length, 2);
  assert.equal(summary.files.filter(f => f.relative.endsWith('/layout.json')).length, 1);
  for (const kind of ['town', 'media']) {
    const names = files.map(file => path.relative(buildDir, file)).filter(name => name.startsWith(kind + '-'));
    const directories = new Set(names.map(name => name.split('/')[0]));
    assert.equal(directories.size, 1, 'mixed or missing asset release: ' + kind);
    const hash = createHash('sha256');
    for (const name of names.sort()) hash.update(path.basename(name)).update(await readFile(path.join(buildDir, name)));
    assert.equal([...directories][0], kind + '-' + hash.digest('hex').slice(0, 12));
  }
  const titles = new Set();
  for (const route of routeNames) {
    const url = new URL(route, base);
    const http = await fetch(url);
    assert.equal(http.status, 200, url.href);
    const html = await http.text();
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    assert.ok(title && !titles.has(title), 'expected unique page title: ' + url.href);
    titles.add(title);
    assert.match(html, /<h1\b[^>]*>[\s\S]+?<\/h1>/);
    assert.match(html, /<a\b[^>]*href=/);
    assert.match(html, /<img\b/);
    summary.routes.push({ path: url.pathname, status: http.status, title, htmlBytes: Buffer.byteLength(html) });
    summary.server = http.headers.get('server');
  }
  for (const missing of ['unknown-route/', 'nested/example/unknown/']) {
    const http = await fetch(new URL(missing, base));
    assert.equal(http.status, 404);
    const bytes = Buffer.from(await http.arrayBuffer());
    assert.ok(bytes.equals(await readFile(path.join(buildDir, '404.html'))));
    summary.missing.push({ path: prefix + missing, status: http.status, sha256: sha256(bytes) });
  }
}
const versionedHashes = build => Object.fromEntries(build.files
  .filter(file => /^(?:town|media)-/.test(file.relative))
  .map(file => [file.relative, file.sha256]));
assert.deepEqual(versionedHashes(results[0]), versionedHashes(results[1]));
await writeFile(path.join(reportDir, 'http-files.json'), JSON.stringify({ origin, results }, null, 2) + '\n');
console.log(results.map(r => `${r.prefix}: ${r.routes.length} routes, ${r.files.length} files, ${r.missing.length} 404s`).join('\n'));
