const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ timezoneId: 'UTC', reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const epoch = Date.parse('2026-11-21T12:00:00Z');
    await page.clock.install({ time: epoch });
    const waitForPopup = async () => {
      const rendered = await page.waitForFunction(() => {
        const popup = document.querySelector('.leaflet-popup .route-point-popup');
        const text = popup?.innerText;
        return text?.includes('سرعت:') && text.includes('عرض جغرافیایی:') && text.includes('طول جغرافیایی:') && [...popup.querySelectorAll('bdi,time')].every(node => text.includes(node.textContent)) ? text : false;
      });
      return rendered.jsonValue();
    };
    const errors = [], unexpected = [];
    let history = [];
    let paginated = false;
    const historyPages = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('gamma_access_token', 'isolated-test-token');
      localStorage.setItem('gamma_product', 'NEGAHBAN');
    });
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
    await page.route(/https:\/\/(.*\.)?tile\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    const handleApi = async route => {
      const endpoint = new URL(route.request().url()).pathname;
      assert.equal(route.request().method(), 'GET');
      let data;
      if (endpoint === '/api/v1/vehicles/') data = [];
      else if (endpoint === '/api/v1/devices/') data = [{ device_code: 'NG-0001', product_type: 'NEGAHBAN' }];
      else if (endpoint.endsWith('/otp/me/')) data = { first_name: 'آزمایش', preferred_product: 'NEGAHBAN' };
      else if (endpoint.endsWith('/notifications/')) data = { items: [], unread_count: 0 };
      else if (endpoint.endsWith('/latest/')) data = null;
      else if (endpoint.endsWith('/history/')) {
        const url = new URL(route.request().url());
        const number = Number(url.searchParams.get('page') || 1);
        historyPages.push(number);
        data = paginated ? { results: history.slice((number - 1) * 60, number * 60), next: number * 60 < history.length ? `${url.origin}${endpoint}?page=${number + 1}` : null } : history;
      }
      else if (endpoint.endsWith('/geofence/')) data = { configured: false, supports_polygon: true, position: 'UNKNOWN' };
      else { unexpected.push(endpoint); return route.abort(); }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    };
    await page.route('https://api.gamma-tech.ir/**', handleApi);
    const first = { id: 1, latitude: 35.70857, longitude: 51.37728, recorded_at: '2026-11-21T09:00:00Z', speed: 0 };
    const last = { id: 2, latitude: 35.71657, longitude: 51.38528, recorded_at: '2026-11-21T10:00:00Z', speed: 42, heading: 90 };
    const base = process.env.E2E_BASE || 'http://127.0.0.1:5178';
    const shots = process.env.E2E_SHOTS || 'test-results/route-markers';
    fs.mkdirSync(shots, { recursive: true });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [name, records, count] of [
        ['chronological', [last, first], 2],
        ['missing-heading-speed', [{ ...last, heading: null, speed: null }, first], 2],
        ['invalid-heading', [{ ...last, heading: 361 }, first], 2],
        ['single', [first], 1],
        ['overlap', [{ ...last, latitude: first.latitude, longitude: first.longitude }, first], 1],
      ]) {
        history = records;
        await page.goto(`${base}/routes`);
        const markers = page.locator('.full-map .route-map-marker');
        await markers.first().waitFor();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.content-shell')).opacity === '1');
        assert.equal(await markers.count(), count);
        const car = page.locator('.full-map .route-map-marker.end');
        assert.equal(await car.locator('.route-vehicle-icon').count(), 1);
        const rotation = await car.locator('svg').getAttribute('style');
        assert.equal(rotation?.includes('rotate(90deg)') || false, ['chronological', 'overlap'].includes(name));
        if (count === 1) assert.match(await car.getAttribute('class'), /includes-start/);
        else {
          const start = page.locator('.full-map .route-map-marker.start');
          assert.equal(await start.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(61, 220, 132)');
          await page.locator('.full-map .leaflet-container').scrollIntoViewIfNeeded();
          await start.click();
          const startPopupText = await waitForPopup();
          assert.ok(await page.locator(`.leaflet-popup .route-point-popup time[datetime="${first.recorded_at}"]`).count() >= 1);
          assert.match(startPopupText, /0 km\/h/);
          await page.locator('.leaflet-popup-close-button').click();
        }
        assert.equal(await car.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 107, 26)');
        const box = await car.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44);
        await page.locator('.full-map .leaflet-container').scrollIntoViewIfNeeded();
        // A mouse opens the single rounded card by hover, without a click.
        await car.hover();
        const carPopupText = await waitForPopup();
        assert.equal(await page.locator('.full-map .leaflet-popup').count(),1);
        assert.equal(await page.locator('.full-map .leaflet-tooltip').count(),0);
        const expectedTimes = name === 'overlap' ? [first.recorded_at, last.recorded_at] : [name === 'single' ? first.recorded_at : last.recorded_at];
        assert.deepEqual(await page.locator('.leaflet-popup .route-point-popup time').evaluateAll(elements => elements.map(el => el.dateTime)), expectedTimes);
        assert.equal(await page.locator('.leaflet-popup .route-point-popup').evaluate(el => getComputedStyle(el).direction), 'rtl');
        if (name === 'missing-heading-speed') assert.match(carPopupText, /سرعت: ثبت نشده/);
        if (name === 'overlap') assert.match(carPopupText, /شروع و پایان در یک موقعیت/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(shots, `routes-${width}-${name}.png`), fullPage: true, animations: 'disabled' });
        // Every row retains its own original coordinate link and timestamp.
        await page.locator('.route-history > summary').click();
        for (const record of records) {
          const row = page.locator('.route-row').filter({ has: page.locator(`time[datetime="${record.recorded_at}"]`) });
          assert.equal(await row.locator('a').getAttribute('href'), `https://nshn.ir/?lat=${record.latitude}&lng=${record.longitude}`);
        }
        assert.equal(await page.locator('.full-map path.leaflet-interactive').count(), records.length + (records.length > 1 ? 1 : 0));
      }
    }
    // Fetch every advertised page and keep older and overlapping records usable.
    paginated = true;
    historyPages.length = 0;
    history = Array.from({ length: 151 }, (_, index) => ({
      ...first, id: index + 1, recorded_at: new Date(Date.parse(first.recorded_at) + index * 60000).toISOString(),
      latitude: first.latitude + index * 0.00003, longitude: first.longitude + index * 0.00003,
      speed: index === 75 ? null : 0,
    }));
    history[100] = { ...history[100], latitude: first.latitude - 0.006, longitude: first.longitude - 0.006 };
    history[74] = { ...history[74], latitude: history[75].latitude, longitude: history[75].longitude };
    await page.goto(`${base}/routes`);
    await page.locator('.route-recorded-point').first().waitFor().catch(async error => {
      console.error({ errors, historyPages, text: await page.locator('body').innerText() });
      throw error;
    });
    assert.deepEqual(historyPages, [1, 2, 3]);
    assert.equal(await page.locator('.route-recorded-point').count(), 151);
    await page.locator('.full-map .leaflet-container').scrollIntoViewIfNeeded();
    const recordedPoint = page.locator('.route-recorded-point').nth(50);
    await recordedPoint.hover();
    await page.locator('.full-map .leaflet-popup .route-point-popup').getByText(/عرض جغرافیایی/).first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.full-map .leaflet-popup').count(), 1, 'mouse hover shows one rounded card');
    assert.equal(await page.locator('.full-map .leaflet-tooltip').count(), 0, 'no duplicate hover tooltip');
    await recordedPoint.click();
    const pointPopupText = await waitForPopup();
    assert.match(pointPopupText, /عرض جغرافیایی|طول جغرافیایی/);
    assert.match(pointPopupText, /0 km\/h/);
    await page.locator('.leaflet-popup-close-button').click();
    await page.locator('.route-history > summary').click();
    assert.equal(await page.locator('.route-row').count(), 151);
    for (const record of [history[74], history[75], history[0]]) {
      const row = page.locator('.route-row').filter({ has: page.locator(`.route-row-main > strong time[datetime="${record.recorded_at}"]`) });
      await row.locator('.route-record-details > summary').click();
      assert.ok((await row.locator('.route-point-popup').innerText()).includes(String(record.latitude)));
      assert.ok((await row.locator('.route-point-popup').innerText()).includes(record.speed === null ? 'ثبت نشده' : '0 km/h'));
    }
    await page.screenshot({ path: path.join(shots, 'routes-all-pages.png'), fullPage: true, animations: 'disabled' });
    paginated = false;
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      history = [1, 8, 12, 24, 48, 168, 169].map((hours, id) => ({ ...first, id, recorded_at: new Date(epoch - hours * 3600000 + 5 * 60000).toISOString(), latitude: first.latitude + id * 0.001 }));
      await page.goto(`${base}/routes`);
      await page.locator('.route-history > summary').click();
      assert.equal(await page.locator('#route-interval').count(), 0);
      assert.equal(await page.locator('.route-row').count(), 7);
      assert.equal(await page.locator('.route-recorded-point').count(), 7);
      assert.equal(await page.locator('.route-row time').last().getAttribute('datetime'), history[6].recorded_at);
      await page.locator('.full-map .leaflet-container').scrollIntoViewIfNeeded();
      await page.locator('.full-map .route-map-marker.end').hover();
      const hoverCard = page.locator('.full-map .route-detail-popup');
      await hoverCard.getByText(/عرض جغرافیایی/).first().waitFor({ state: 'visible' });
      assert.equal(await hoverCard.count(), 1);
      assert.equal(await page.locator('.full-map .leaflet-tooltip').count(), 0);
      const hoverBox = await hoverCard.boundingBox();
      assert.ok(hoverBox.width >= 160 && hoverBox.width <= 320, `Unreadable popup width at ${width}px: ${hoverBox.width}`);
      assert.ok(hoverBox.height < 240, `Popup text is wrapping excessively at ${width}px`);
      // Desktop users keep the same card open by hovering; tap is covered below.
      await page.locator('.full-map .route-map-marker.end').hover();
      const popupText = await waitForPopup();
      assert.match(popupText, /0 km\/h/);
      await page.locator('.leaflet-popup-close-button').click();
      history = [];
      await page.goto(`${base}/routes`);
      await page.locator('.route-history > summary').click();
      assert.equal(await page.locator('.route-row').count(), 0);
      assert.match(await page.locator('.map-empty').innerText(), /هنوز نقطه‌ای برای این دستگاه دریافت نشده است/);
      assert.match(await page.locator('.route-history .empty-state').innerText(), /هنوز نقطه‌ای برای این دستگاه دریافت نشده است/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    // On phones and touch-enabled tablets, tap (not mouse hover) opens
    // the exact same single rounded detail card.
    paginated = false;
    history = [last, first];
    const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchErrors = [];
    touchPage.on('pageerror', error => touchErrors.push(error.message));
    await touchPage.addInitScript(() => {
      localStorage.setItem('gamma_access_token', 'isolated-test-token');
      localStorage.setItem('gamma_product', 'NEGAHBAN');
    });
    await touchPage.route(/https:\/\/(.*\.)?tile\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await touchPage.route('https://api.gamma-tech.ir/**', handleApi);
    await touchPage.goto(`${base}/routes`);
    const carOnTouch = touchPage.locator('.full-map .route-map-marker.end');
    await carOnTouch.waitFor();
    await carOnTouch.tap();
    await touchPage.locator('.full-map .route-detail-popup .route-point-popup').waitFor({ state: 'visible' });
    assert.equal(await touchPage.locator('.full-map .leaflet-popup').count(), 1);
    assert.equal(await touchPage.locator('.full-map .leaflet-tooltip').count(), 0);
    assert.deepEqual(touchErrors, []);
    await touchPage.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    console.log('PASS: route markers at 320/390/1280; chronological order; heading/missing speed; single/overlapping positions; popups; original links and line; three pages/151 points; overlap list details; unfiltered history and empty coverage at 320/390/1280');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
