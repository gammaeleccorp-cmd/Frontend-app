const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

async function build(sha, out) {
  const child = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', out], {
    env: { ...process.env, GITHUB_SHA: sha }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 0, 'transition fixture build');
}

(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-update-'));
  const old = 'a'.repeat(40), next = 'b'.repeat(40);
  let active = old, staleHtml = false, metadataError = false;
  const folders = { [old]: path.join(temporary, 'old'), [next]: path.join(temporary, 'new') };
  let context, server;
  try {
    await build(old, folders[old]);
    await build(next, folders[next]);
    server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://localhost');
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === '/release.json') {
          response.writeHead(metadataError ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
          return response.end(JSON.stringify({ component: 'frontend', source_commit: active }));
        }
        let body, type = 'text/html';
        if (pathname.startsWith('/assets/') && !pathname.includes('..')) {
          const name = path.basename(pathname);
          try { body = await fs.readFile(path.join(folders[active], 'assets', name)); }
          catch { body = await fs.readFile(path.join(folders[old], 'assets', name)); }
          type = name.endsWith('.css') ? 'text/css' : 'application/javascript';
        } else if (pathname === '/manifest.webmanifest') {
          body = await fs.readFile(path.join(folders[active], 'manifest.webmanifest'));
          type = 'application/manifest+json';
        } else {
          body = await fs.readFile(path.join(folders[staleHtml ? old : active], 'index.html'));
        }
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache, max-age=0, must-revalidate' });
        response.end(body);
      } catch {
        response.writeHead(404); response.end();
      }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const profile = path.join(temporary, 'profile');
    context = await chromium.launchPersistentContext(profile, { headless: true });
    // No authentication or OTP traffic can escape this isolated test.
    await context.route('https://api.gamma-tech.ir/**', route => route.abort());
    const first = await context.newPage(), second = await context.newPage();
    const base = `${origin}/register?device=NG-0001#draft`;
    await first.goto(base);
    await second.goto(base);
    await first.evaluate(async () => {
      localStorage.setItem('gamma_product', 'NEGAHBAN');
      localStorage.setItem('gamma_refresh_token', 'isolated-preserved-refresh');
      sessionStorage.setItem('draft-marker', 'preserve');
      document.cookie = 'update-test=preserve; SameSite=Lax';
      const cache = await caches.open('unrelated-offline-data');
      await cache.put('/offline-record', new Response('preserve'));
    });
    const identity = page => page.locator('meta[name="gamma-release"]').getAttribute('content');
    const check = async page => {
      await page.bringToFront();
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    };
    assert.equal(await identity(first), old);
    metadataError = true;
    active = next;
    await check(first);
    await first.waitForTimeout(200);
    assert.equal(await identity(first), old);
    assert.equal(await first.locator('.release-update').count(), 0);
    metadataError = false;
    await check(first);
    await first.getByText('نسخهٔ جدید آماده است', { exact: true }).waitFor();
    await first.locator('#firstName').fill('پیش‌نویس ذخیره‌نشده');
    first.once('dialog', dialog => dialog.dismiss());
    await first.getByRole('button', { name: 'به‌روزرسانی', exact: true }).click();
    assert.equal(await first.locator('#firstName').inputValue(), 'پیش‌نویس ذخیره‌نشده');
    assert.equal(await identity(first), old);
    await check(second);
    await second.getByText('نسخهٔ جدید آماده است', { exact: true }).waitFor();
    staleHtml = true;
    await second.getByRole('button', { name: 'به‌روزرسانی', exact: true }).click();
    await second.getByRole('alert').filter({ hasText: 'به‌روزرسانی انجام نشد' }).waitFor();
    assert.equal(await identity(second), old, 'mismatched preflight HTML must not reload');
    staleHtml = false;
    await context.setOffline(true);
    await second.getByRole('button', { name: 'به‌روزرسانی', exact: true }).click();
    await second.waitForFunction(() => !document.querySelector('.release-update button').disabled);
    assert.equal(await identity(second), old, 'offline update must keep the current app');
    await context.setOffline(false);
    await second.getByRole('button', { name: 'به‌روزرسانی', exact: true }).click();
    await second.waitForFunction(sha => document.querySelector('meta[name="gamma-release"]').content === sha, next);
    assert.equal(await identity(first), old, 'another tab must not force a reload');
    assert.equal(await first.locator('#firstName').inputValue(), 'پیش‌نویس ذخیره‌نشده');
    first.once('dialog', dialog => dialog.accept());
    await first.getByRole('button', { name: 'به‌روزرسانی', exact: true }).click();
    await first.waitForFunction(sha => document.querySelector('meta[name="gamma-release"]').content === sha, next);
    await first.waitForFunction(() => !location.search.includes('__gamma_release'));
    assert.equal(first.url(), base);
    assert.deepEqual(await first.evaluate(async () => ({
      product: localStorage.getItem('gamma_product'), refresh: localStorage.getItem('gamma_refresh_token'),
      session: sessionStorage.getItem('draft-marker'), cookie: document.cookie,
      offline: await (await caches.match('/offline-record')).text(),
    })), { product: 'NEGAHBAN', refresh: 'isolated-preserved-refresh', session: 'preserve', cookie: 'update-test=preserve', offline: 'preserve' });
    let navigations = 0;
    first.on('framenavigated', frame => { if (frame === first.mainFrame()) navigations += 1; });
    await check(first);
    await first.waitForTimeout(300);
    assert.equal(navigations, 0, 'no automatic reload loop after updating');
    // Reopen the same on-disk profile: cached resources and settings persist.
    await context.close();
    context = await chromium.launchPersistentContext(profile, { headless: true });
    const reopened = await context.newPage();
    await reopened.goto(base);
    assert.equal(await identity(reopened), next);
    assert.equal(await reopened.evaluate(() => localStorage.getItem('gamma_refresh_token')), 'isolated-preserved-refresh');
    const fresh = await chromium.launchPersistentContext(path.join(temporary, 'fresh'), { headless: true });
    try {
      const page = await fresh.newPage();
      await page.goto(base);
      assert.equal(await identity(page), next);
    } finally { await fresh.close(); }
    console.log('PASS: two real release builds; persistent profile; independent tabs; form cancel; failed metadata/HTML/offline checks; storage/cookie/Cache preservation; no reload loop; reopened and fresh clients. Native installed PWA lifecycle is not supported by this headless test.');
  } finally {
    if (context) await context.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
