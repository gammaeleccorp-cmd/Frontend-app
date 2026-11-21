const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [], unexpected = [];
    const epoch = Date.parse('2026-11-21T10:00:00Z');
    const stamp = new Date(epoch).toISOString();
    let sample;
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(epoch);
    await page.addInitScript(() => {
      localStorage.setItem('gamma_access_token', 'isolated-test-token');
      localStorage.setItem('gamma_product', 'NEGAHBAN');
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://api.gamma-tech.ir/**', async route => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname;
      let data;
      assert.equal(route.request().method(), 'GET', 'status indicators must never write');
      if (endpoint === '/api/v1/vehicles/') data = [];
      else if (endpoint === '/api/v1/devices/') data = [{ device_code: 'NG-0001', product_type: 'NEGAHBAN', status: 'ACTIVE' }];
      else if (endpoint.endsWith('/otp/me/')) data = { first_name: 'آزمایش', preferred_product: 'NEGAHBAN' };
      else if (endpoint.endsWith('/notifications/')) data = { items: [], unread_count: 0 };
      else if (endpoint.endsWith('/latest/')) data = sample;
      else if (endpoint.endsWith('/history/')) data = [];
      else if (endpoint.endsWith('/geofence/')) data = { configured: false, position: 'UNKNOWN' };
      else { unexpected.push(endpoint); return route.abort(); }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const base = process.env.E2E_BASE || 'http://127.0.0.1:5178';
    const shots = process.env.E2E_SHOTS || 'test-results/compact-dashboard';
    fs.mkdirSync(shots, { recursive: true });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [name, fields, state, voltage, online] of [
        ['on', { device_status: 1, battery_voltage: 3.96 }, 'روشن', '3.96 V', 'Online'],
        ['off', { device_status: 0, battery_voltage: 0 }, 'خاموش', '0.00 V', 'Online'],
        ['unknown', {}, 'نامشخص', 'ثبت نشده', 'Online'],
        ['stale', { device_status: 1, recorded_at: new Date(epoch - 360000).toISOString(), received_at: new Date(epoch - 360000).toISOString() }, 'نامشخص', 'ثبت نشده', 'Offline'],
        ['delayed', { device_status: 1, recorded_at: new Date(epoch - 360000).toISOString() }, 'نامشخص', 'ثبت نشده', 'Online'],
        ['missing', { recorded_at: null, received_at: null }, 'نامشخص', 'ثبت نشده', 'Offline'],
      ]) {
        sample = { speed: 45, recorded_at: stamp, received_at: stamp, ...fields };
        await page.goto(`${base}/home`);
        await page.locator('.switch-status').waitFor();
        await page.clock.runFor(500);
        assert.equal(await page.locator('.switch-status').innerText(), state);
        assert.equal(await page.locator('.battery-detail span').innerText(), voltage);
        const blocks = await page.locator('.switch-detail,.battery-detail').evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
        assert.ok(Math.abs(blocks[0].width - blocks[1].width) < 1);
        assert.ok(Math.abs(blocks[0].height - blocks[1].height) < 1);
        const power = await page.locator('.switch-detail > svg').boundingBox();
        assert.ok(power.width >= 48 && power.width <= 56);
        assert.equal(await page.locator('.switch-detail > svg').evaluate(el => getComputedStyle(el).color), name === 'on' ? 'rgb(61, 220, 132)' : 'rgb(155, 158, 166)');
        assert.equal(await page.locator('.tracker-overview .status-badge').innerText(), online);
        if (name === 'missing') assert.match(await page.locator('.device-received').innerText(), /ثبت نشده/);
        const switchIndicator = page.locator('.switch-status');
        assert.equal(await switchIndicator.getAttribute('tabindex'), null);
        assert.equal(await page.locator('.speed-card button,.speed-card input').count(), 0);
        assert.equal(await page.locator('.metric-card').filter({ hasText: /ACC|ولتاژ باتری/ }).count(), 0);
        await switchIndicator.click();
        assert.equal(await switchIndicator.innerText(), state);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('.tracker-overview').evaluate(el => getComputedStyle(el).direction), 'rtl');
        for (const selector of ['.tracker-overview h2', '.device-code-badge', '.device-freshness', '.device-received', '.tracker-overview button']) {
          const centered = await page.locator(selector).evaluate(el => {
            const box = el.getBoundingClientRect(), parent = el.closest('.tracker-overview').getBoundingClientRect();
            return Math.abs(box.x + box.width / 2 - parent.x - parent.width / 2) < 2 && el.scrollWidth <= el.clientWidth + 1;
          });
          assert.equal(centered, true, `${selector} at ${width}`);
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const nav = await page.locator('.bottom-nav').boundingBox();
        const end = await page.locator('.device-help').boundingBox();
        assert.ok(end.y + end.height < nav.y, `bottom content overlaps navigation at ${width}`);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (['on', 'off', 'missing'].includes(name)) await page.screenshot({ path: path.join(shots, `home-${width}-${name}.png`), fullPage: true, animations: 'disabled' });
      }
      await page.getByRole('button', { name: 'اطلاعات دستگاه', exact: true }).click();
      await page.waitForURL('**/vehicle');
      await page.clock.runFor(500);
      assert.equal(await page.locator('.device-received').innerText(), 'آخرین دریافت: ثبت نشده');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const overview = await page.locator('.tracker-overview').boundingBox();
      assert.ok(overview.height < 200, `overview height at ${width}: ${overview.height}`);
      const heading = await page.locator('.page-header h2').boundingBox();
      assert.ok(Math.abs(heading.x + heading.width / 2 - overview.x - overview.width / 2) < 2);
      await page.screenshot({ path: path.join(shots, `device-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    // Advance the real application timer without reloading, while API polling
    // continues to return the same sample. Check both connection and ACC expiry.
    for (const view of ['home', 'vehicle']) {
      await page.clock.setSystemTime(epoch);
      sample = { speed: 45, device_status: 1, battery_voltage: 3.96, recorded_at: stamp, received_at: stamp };
      await page.goto(`${base}/${view}`);
      await page.locator('.tracker-overview .status-badge').waitFor();
      assert.equal(await page.locator('.tracker-overview .status-badge').innerText(), 'Online');
      await page.clock.runFor(301000);
      assert.equal(await page.locator('.tracker-overview .status-badge').innerText(), 'Offline');
      assert.equal(await page.locator('.device-received time').getAttribute('datetime'), stamp);
      if (view === 'home') assert.equal(await page.locator('.switch-status').innerText(), 'نامشخص');
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    console.log('PASS: RTL 320/390/1280; switch on/off/unknown/stale/delayed; battery zero/missing; missing timestamps; home and device Online-to-Offline expiry; read-only status');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
