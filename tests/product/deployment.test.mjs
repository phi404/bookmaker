import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { absolute } from '../../scripts/lib.mjs';
import { createStaticServer, normalizeBasePath } from '../../scripts/static-server.mjs';

async function withSite(action) {
  const server = await createStaticServer(absolute('dist'), { basePath: '/compholio/' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('static deployment serves HTML, modules, fonts and PDF resources beneath a project prefix', () => withSite(async origin => {
  for (const [file, mime] of [['index.html', 'text/html'], ['ui/main.js', 'text/javascript'], ['fonts/NotoSerifJP-Regular.otf', 'font/otf'], ['vendor/pdfjs/pdf.worker.mjs', 'text/javascript'], ['vendor/pdfjs/wasm/openjpeg.wasm', 'application/wasm']]) {
    const response = await globalThis.fetch(`${origin}/compholio/${file}`);
    assert.equal(response.status, 200, file); assert.ok(response.headers.get('content-type').startsWith(mime), file);
    assert.ok((await response.arrayBuffer()).byteLength > 0, file);
  }
  const html = await (await globalThis.fetch(`${origin}/compholio/`)).text();
  assert.ok(html.includes('src="./ui/main.js"')); assert.ok(html.includes("default-src 'self'")); assert.ok(!html.includes('{{CONTENT_SECURITY_POLICY}}'));
  assert.equal((await globalThis.fetch(`${origin}/ui/main.js`)).status, 404);
}));
test('static serving preserves HEAD, redirects the project root and rejects traversal and writes', () => withSite(async origin => {
  const canonical = await globalThis.fetch(`${origin}/compholio`, { redirect: 'manual' });
  assert.equal(canonical.status, 301); assert.equal(canonical.headers.get('location'), '/compholio/');
  const head = await globalThis.fetch(`${origin}/compholio/app.css`, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.ok(Number(head.headers.get('content-length')) > 0); assert.equal(await head.text(), '');
  assert.ok(head.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  for (const route of ['/compholio/../../package.json', '/compholio/%2e%2e/package.json', '/compholio/%5c..%5cpackage.json', '/compholio/%00']) assert.equal((await globalThis.fetch(origin + route)).status, 404, route);
  assert.equal((await globalThis.fetch(`${origin}/compholio/`, { method: 'POST' })).status, 405);
}));
test('deployment base paths cannot contain another origin, query, fragment or traversal', () => {
  assert.equal(normalizeBasePath('/compholio'), '/compholio/'); assert.equal(normalizeBasePath('/'), '/');
  for (const value of ['https://example.com/', '/a/../', '/./', '//example.com/', '/a?x=1', '/a#x', '/%2e%2e/', '/a\\b']) assert.throws(() => normalizeBasePath(value), /Invalid site base path/u);
});

test('the pinned bundled font fingerprint matches the actual font used by portable projects', async () => {
  const { readFile } = await import('node:fs/promises'), { createHash } = await import('node:crypto'), { bundledFont } = await import('../../dist/io/resources.js');
  assert.equal(createHash('sha256').update(await readFile(absolute('public/' + bundledFont.path))).digest('hex'), bundledFont.sha256);
});
