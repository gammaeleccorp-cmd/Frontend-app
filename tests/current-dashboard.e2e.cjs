const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(() => {
      localStorage.setItem("gamma_access_token", "isolated-test-token");
      localStorage.setItem("gamma_product", "NEGAHBAN");
    });

    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-16T10:00:00Z"));
    const unexpected = [];
    const pageErrors = [];
    const geofenceWrites = [];
    let geofence = { supports_six_point_polygon: true, supports_polygon: true, configured: false, is_active: false, position: "UNKNOWN" };
    page.on("pageerror", e => pageErrors.push(e.message));
    // Keep map controls interactive without relying on the external tile service.
    const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
    await page.route(/https:\/\/(.*\.)?tile\.openstreetmap\.org\//, route => route.fulfill({contentType:'image/png',body:tile}));

    await page.route("https://api.gamma-tech.ir/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      let status = 200;
      let data;

      if (path === "/api/v1/vehicles/") data = [];
      else if (path === "/api/v1/devices/") data = [
        { id: "d1", device_code: "NG-0001", product_type: "NEGAHBAN", status: "ACTIVE", vehicle_id: null }
      ];
      else if (path === "/api/v1/auth/otp/me/") data = {
        first_name: "سید محمدحسین عبدالرحمن نامبسیارطولانیبدونفاصلهبرایآزمایشچیدمان", last_name: "کاربر",
        mobile: "09111111111", preferred_product: "NEGAHBAN"
      };
      else if (path === "/api/v1/notifications/") data = { unread_count: 20, items: Array.from({length:20},(_,i)=>({id:i,title:"اعلان",body:"پیام بلند فارسی ".repeat(35)})) };
      else if (path === "/api/v1/notifications/read/") data = {};
      else if (path === "/api/v1/telemetry/devices/NG-0001/latest/") data = null;
      else if (path === "/api/v1/telemetry/devices/NG-0001/history/") data = [
        { id: 1, latitude: 35.70857123, longitude: 51.37728456, recorded_at: "2026-11-16T08:00:00Z", speed: 12 },
        { id: 2, latitude: 36.12345678, longitude: 52.87654321, recorded_at: "2026-11-16T09:30:00Z", speed: 24 }
      ];
      else if (path === "/api/v1/devices/NG-0001/geofence/") {
        if (method === "GET") data = geofence;
        else if (method === "PUT") {
          const body = request.postDataJSON();
          geofenceWrites.push({ method, body });
          geofence = { ...geofence, ...body, configured: true, is_active: true, position: "INSIDE", last_recorded_at: "2026-10-31T08:00:00Z" };
          data = geofence;
        } else if (method === "DELETE") {
          geofenceWrites.push({ method });
          geofence = { ...geofence, is_active: false, position: "UNKNOWN" };
          data = null;
        }
      }
      else {
        unexpected.push(`${route.request().method()} ${path}`);
        return route.abort();
      }

      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data)
      });
    });

    await page.goto(`${process.env.E2E_BASE || "http://127.0.0.1:5178"}/home`);

    await page.locator(".tracker-overview").waitFor();
    await page.locator(".device-code-badge").waitFor();
    // Sample the existing fade at entrance, visible, and exit frames with a long RTL name.
    for (const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      await page.reload();
      const welcome=page.locator('.welcome-toast');
      await welcome.waitFor({state:'attached'});
      for(const time of [0,160,320,2000,3280,3800,3999]) {
        const layout=await welcome.evaluate((el,time)=>{
          const animation=el.getAnimations()[0];
          animation.pause(); animation.currentTime=time;
          const box=el.getBoundingClientRect();
          const brand=document.querySelector('.gamma-brand').getBoundingClientRect();
          return {top:box.top,bottom:brand.bottom,left:box.left,right:box.right,
            rtl:getComputedStyle(el).direction,wrapped:box.height>70,
            fits:el.scrollWidth<=el.clientWidth+1};
        },time);
        assert.ok(layout.top>=layout.bottom+10,`welcome overlaps brand at ${width}px / ${time}ms`);
        assert.ok(layout.left>=0 && layout.right<=width);
        assert.equal(layout.rtl,'rtl');
        assert.equal(layout.wrapped,true);
        assert.equal(layout.fits,true);
      }
      await welcome.evaluate(el=>{ el.getAnimations()[0].currentTime=2000; });
      if(process.env.E2E_SHOTS) {
        require('node:fs').mkdirSync(process.env.E2E_SHOTS,{recursive:true});
        await page.screenshot({path:require('node:path').join(process.env.E2E_SHOTS,`welcome-${width}.png`)});
      }
      await welcome.waitFor({state:'detached',timeout:5000});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.reload();
    await page.locator('.welcome-toast').waitFor({state:'attached'});
    assert.equal(await page.locator('.welcome-toast').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.locator('.welcome-toast').waitFor({state:'detached',timeout:5000});
    await page.emulateMedia({reducedMotion:'no-preference'});
    for (const width of [320,1280]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.getByRole('button',{name:'افزودن دستگاه',exact:true}).count(),0);
      assert.equal(await page.locator('.home-actions,.welcome-start,#registration-status').count(),0);
      assert.equal(await page.getByText(/ثبت دستگاه .*در دسترس نیست/).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(`${process.env.E2E_BASE || "http://127.0.0.1:5178"}/add-device`);
    await page.waitForURL('**/home');
    await page.locator(".tracker-overview").waitFor();
    assert.equal(await page.locator('#device-code').count(),0);
    assert.equal(await page.locator('a[href*="nshn.ir"]').count(),0);
    await page.goto(`${process.env.E2E_BASE || "http://127.0.0.1:5178"}/vehicle`);
    await page.getByRole('heading', { name: 'دستگاه نگهبان', exact: true }).waitFor();
    for (const width of [320,390,1280]) {
      await page.setViewportSize({width,height:844});
      const title=page.locator('.negahban-device-page .page-header');
      assert.equal(await title.getByRole('heading').count(),1);
      assert.equal(await title.locator('.eyebrow').count(),0);
      assert.equal(await title.locator('.muted').count(),0);
      assert.equal(await page.locator('.gamma-brand').getAttribute('dir'),'ltr');
      assert.equal(await page.locator('.tracker-overview,.device-code-badge,.device-received').count(),0);
      assert.match(await page.locator('.info-grid').innerText(),/NG-0001/);
      for (const selector of ['.gamma-brand','.gamma-brand-wordmark','.gamma-brand-subtitle','.negahban-device-page h2']) {
        assert.equal(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${selector} clips at ${width}`);
      }
      const back=title.getByRole('button',{name:'بازگشت'});
      const backBox=await back.boundingBox(), headingBox=await title.getByRole('heading').boundingBox();
      assert.ok(backBox.x>=headingBox.x+headingBox.width,'back button is at RTL leading edge');
      assert.ok(Math.abs(backBox.y+backBox.height/2-headingBox.y-headingBox.height/2)<2);
      for (const control of [back,page.getByRole('button',{name:/اعلان‌ها/})]) {
        await control.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await control.evaluate(el=>el===document.activeElement && el.matches(':focus-visible') && getComputedStyle(el).outlineStyle!=='none' && parseFloat(getComputedStyle(el).outlineWidth)>=2),true);
      }
      const brandBox=await page.locator('.gamma-brand').boundingBox(), headerBox=await page.locator('.app-header').boundingBox();
      assert.ok(Math.abs(brandBox.x+brandBox.width/2-headerBox.x-headerBox.width/2)<2);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(process.env.E2E_SHOTS) {
        require('node:fs').mkdirSync(process.env.E2E_SHOTS,{recursive:true});
        await page.screenshot({path:require('node:path').join(process.env.E2E_SHOTS,`headers-${width}.png`),fullPage:true});
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(`${process.env.E2E_BASE || "http://127.0.0.1:5178"}/home`);
    await page.locator(".tracker-overview").waitFor();

    await page.locator(".geofence-card").waitFor();
    await page.locator(".geofence-card button").click();
    await page.waitForURL("**/routes");

    const disclosure=page.locator('.route-history');
    const summary=disclosure.locator(':scope > summary');
    const rows=page.locator('.route-row');
    assert.equal(await disclosure.getAttribute('open'),null);
    assert.equal(await rows.first().isVisible(),false);
    assert.match(await summary.innerText(),/2 مورد/);
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await rows.first().isVisible(),true);
    await page.keyboard.press('Space');
    assert.equal(await rows.first().isVisible(),false);
    await page.keyboard.press('Enter');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(() => {
      const chevron = document.querySelector(".route-history-chevron");
      return getComputedStyle(chevron).transitionDuration.split(",")
        .every(duration => Number.parseFloat(duration) <= 0.001);
    });
    await page.emulateMedia({reducedMotion:'no-preference'});
    assert.equal(await rows.count(),2);
    assert.equal(await page.locator('a[href*="nshn.ir"]').count(),2);
    const expected=[
      ['2026-11-16T09:30:00Z','https://nshn.ir/?lat=36.12345678&lng=52.87654321'],
      ['2026-11-16T08:00:00Z','https://nshn.ir/?lat=35.70857123&lng=51.37728456']
    ];
    const opened=[];
    await context.route('https://nshn.ir/**',async route=>{
      opened.push(route.request().url());
      await route.fulfill({contentType:'text/html',body:'<title>Recorded point</title>'});
    });
    for(let i=0;i<expected.length;i++) {
      const row=rows.nth(i), link=row.getByRole('link',{name:'مشاهده در نشان',exact:true});
      assert.equal(await row.locator('.route-row-main > strong time').getAttribute('datetime'),expected[i][0]);
      assert.ok((await row.locator('.route-row-main > strong time').innerText()).length>5);
      assert.equal(await link.getAttribute('href'),expected[i][1]);
      const popupPromise=context.waitForEvent('page');
      await link.click();
      const popup=await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(),expected[i][1]);
      await popup.close();
    }
    assert.deepEqual(opened,expected.map(item=>item[1]));
    assert.equal(await page.locator('.full-map .leaflet-container').count(),1);
    assert.equal(await page.locator('.full-map path.leaflet-interactive').count(),3);
    assert.equal(await page.locator('.full-map .route-map-marker').count(),2);

    const routeMap=page.locator('.full-map .leaflet-container');
    const routeMapElement=await routeMap.elementHandle();
    for(const expanded of [false,true,false]) {
      await summary.click();
      assert.equal(await rows.first().isVisible(),expanded);
      assert.equal(await routeMap.evaluate((el,original)=>el===original,routeMapElement),true);
      await routeMap.scrollIntoViewIfNeeded();
      const zoom=routeMap.locator('.leaflet-control-zoom-in');
      const before=await routeMap.locator('.leaflet-proxy').getAttribute('style');
      await zoom.click();
      await page.waitForTimeout(300);
      assert.notEqual(await routeMap.locator('.leaflet-proxy').getAttribute('style'),before);
    }
    await page.getByRole("button",{name:/محدوده جغرافیایی/}).click();
    const map=page.locator('#fence-editor .leaflet-container');
    await page.waitForTimeout(250);
    await map.scrollIntoViewIfNeeded();
    for(const [x,y] of [[70,70],[135,55],[205,85],[215,180],[140,220],[65,175]]) await map.click({position:{x,y}});
    await page.getByText('۶ از ۶ نقطه',{exact:true}).waitFor();
    const releaseIdentity = await page.locator('meta[name="gamma-release"]').getAttribute('content');
    if (/^[a-f0-9]{40}$/.test(releaseIdentity)) {
      let offered = 'b'.repeat(40);
      const metadata = route => route.fulfill({contentType:'application/json',body:JSON.stringify({component:'frontend',source_commit:offered})});
      await page.route('**/release.json', metadata);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.getByText('نسخهٔ جدید آماده است',{exact:true}).waitFor();
      await page.getByRole('button',{name:'به‌روزرسانی',exact:true}).click();
      await page.getByText('ابتدا محدودهٔ در حال ویرایش را ذخیره یا پاک کنید و منتظر پایان ذخیره بمانید.',{exact:true}).waitFor();
      await page.getByText('۶ از ۶ نقطه',{exact:true}).waitFor();
      assert.ok(page.url().endsWith('/routes'), 'draft update must not navigate');
      offered = releaseIdentity;
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.locator('.release-update').waitFor({state:'detached'});
      await page.unroute('**/release.json', metadata);
    }
    // History disclosure must preserve the mounted geofence map and its unsaved vertices.
    const fenceMapElement=await map.elementHandle();
    for(const expanded of [true,false]) {
      await summary.click();
      assert.equal(await rows.first().isVisible(),expanded);
      assert.equal(await map.evaluate((el,original)=>el===original,fenceMapElement),true);
      await page.getByText('۶ از ۶ نقطه',{exact:true}).waitFor();
    }
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    await page.getByRole('button',{name:'حذف آخرین نقطه'}).click();
    await page.getByText('۵ از ۶ نقطه',{exact:true}).waitFor();
    await map.scrollIntoViewIfNeeded();
    await map.click({position:{x:80,y:210}});
    await page.getByText('۶ از ۶ نقطه',{exact:true}).waitFor();
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    assert.equal(await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).isDisabled(),false,await page.locator('#fence-editor').innerText());
    await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).click();
    await page.getByText('محدوده ذخیره شد.',{exact:true}).waitFor();
    assert.equal(geofenceWrites[0].body.boundary_points.length,6);
    await page.reload();
    await page.getByRole('button',{name:/محدوده جغرافیایی/}).click();
    await page.getByText('۶ از ۶ نقطه',{exact:true}).waitFor();
    assert.equal(await page.locator('#fence-editor .leaflet-container').count(),1);
    geofence = { supports_polygon: true, configured: true, is_active: true, position: 'INSIDE',
      boundary_points: [[35.70,51.37],[35.70,51.38],[35.71,51.38],[35.71,51.37]] };
    await page.reload();
    await page.getByRole('button',{name:/محدوده جغرافیایی/}).click();
    await page.getByText('۴ از ۴ نقطه',{exact:true}).waitFor();
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    await page.getByRole('button',{name:'حذف آخرین نقطه'}).click();
    await page.getByText('۳ از ۴ نقطه',{exact:true}).waitFor();
    await page.getByRole('button',{name:'ریست محدوده'}).click();
    await page.getByText('۴ از ۴ نقطه',{exact:true}).waitFor();
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    assert.equal(await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).isDisabled(),false);
    await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).click();
    assert.equal(geofenceWrites.at(-1).body.boundary_points.length,4);
    await page.reload();
    await page.getByRole('button',{name:/محدوده جغرافیایی/}).click();
    await page.getByText('۴ از ۴ نقطه',{exact:true}).waitFor();
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button',{name:'حذف نقاط'}).click();
    await page.getByText('۰ از ۴ نقطه',{exact:true}).waitFor();
    for(const [x,y] of [[70,70],[215,215],[65,210],[210,65]]) await map.click({position:{x,y}});
    await page.getByRole('button',{name:'ابزارهای GEO'}).click();
    assert.equal(await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:/اعلان‌ها/}).click();
    const panel=page.locator('.notification-panel');
    await panel.waitFor();
    assert.equal(await page.locator('.notification-list').evaluate(el=>el.scrollHeight>el.clientHeight),true);
    const okay = panel.getByRole('button', { name: 'باشه', exact: true });
    const okayBounds = await okay.boundingBox();
    const listBounds = await panel.locator('.notification-list').boundingBox();
    assert.ok(okayBounds && listBounds && okayBounds.y + okayBounds.height <= listBounds.y);
    await okay.click();
    assert.equal(await panel.count(), 0);
    await page.getByRole('button',{name:/اعلان‌ها/}).click();
    await panel.getByText('اعلان جدیدی وجود ندارد.').waitFor();
    assert.equal(await okay.isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await panel.count(),0);
    for(const width of [320,390,1280]) {
      await page.setViewportSize({width,height:844});
      const box=await page.locator('.platform-title').boundingBox();
      const header=await page.locator('.app-header').boundingBox();
      assert.ok(Math.abs(box.x+box.width/2-header.x-header.width/2)<2);
    }
    assert.deepEqual(unexpected, [], "Unexpected API requests");
    assert.deepEqual(pageErrors, [], "Browser errors");

    console.log("PASS: current Negahban dashboard and Geofence card");
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
