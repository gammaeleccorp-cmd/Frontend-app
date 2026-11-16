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
    const unexpected = [];
    const pageErrors = [];
    const geofenceWrites = [];
    let geofence = { supports_polygon: true, configured: false, is_active: false, position: "UNKNOWN" };
    page.on("pageerror", e => pageErrors.push(e.message));
    await page.route("https://*.tile.openstreetmap.org/**", route => route.abort());
    await page.route("https://tile.openstreetmap.org/**", route => route.abort());

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
        first_name: "تست", last_name: "کاربر",
        mobile: "09111111111", preferred_product: "NEGAHBAN"
      };
      else if (path === "/api/v1/notifications/") data = { unread_count: 20, items: Array.from({length:20},(_,i)=>({id:i,title:"اعلان",body:"پیام بلند فارسی ".repeat(35)})) };
      else if (path === "/api/v1/notifications/read/") data = {};
      else if (path === "/api/v1/telemetry/devices/NG-0001/latest/") data = null;
      else if (path === "/api/v1/telemetry/devices/NG-0001/history/") data = [
        { id: 1, latitude: 35.70857123, longitude: 51.37728456, recorded_at: "2026-11-15T08:00:00Z", speed: 12 },
        { id: 2, latitude: 36.12345678, longitude: 52.87654321, recorded_at: "2026-11-16T09:30:00Z", speed: 24 }
      ];
      else if (path === "/api/v1/devices/NG-0001/geofence/") {
        if (method === "GET") data = geofence;
        else if (method === "PUT") {
          const body = request.postDataJSON();
          geofenceWrites.push({ method, body });
          geofence = { ...body, supports_polygon: true, configured: true, is_active: true, position: "INSIDE", last_recorded_at: "2026-10-31T08:00:00Z" };
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

    await page.getByText("وضعیت ردیاب", { exact: true }).waitFor();
    await page.getByText("دستگاه NG-0001", { exact: true }).waitFor();
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
    await page.getByText("وضعیت ردیاب", { exact: true }).waitFor();
    assert.equal(await page.locator('#device-code').count(),0);
    assert.equal(await page.locator('a[href*="neshan.org"]').count(),0);
    await page.locator(".geofence-card").waitFor();
    await page.locator(".geofence-card button").click();
    await page.waitForURL("**/routes");

    const rows=page.locator('.route-row');
    assert.equal(await rows.count(),2);
    assert.equal(await page.locator('a[href*="neshan.org"]').count(),2);
    const expected=[
      ['2026-11-16T09:30:00Z','https://neshan.org/maps/@36.12345678,52.87654321,16z'],
      ['2026-11-15T08:00:00Z','https://neshan.org/maps/@35.70857123,51.37728456,16z']
    ];
    const opened=[];
    await context.route('https://neshan.org/**',async route=>{
      opened.push(route.request().url());
      await route.fulfill({contentType:'text/html',body:'<title>Recorded point</title>'});
    });
    for(let i=0;i<expected.length;i++) {
      const row=rows.nth(i), link=row.getByRole('link',{name:'مشاهده در نشان',exact:true});
      assert.equal(await row.locator('time').getAttribute('datetime'),expected[i][0]);
      assert.ok((await row.locator('time').innerText()).length>5);
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
    assert.equal(await page.locator('.full-map path.leaflet-interactive').count(),2);

    await page.getByRole("button",{name:/محدوده جغرافیایی/}).click();
    const map=page.locator('#fence-editor .leaflet-container');
    await page.waitForTimeout(250);
    for(const [x,y] of [[70,70],[180,65],[205,200],[80,210]]) await map.click({position:{x,y}});
    await page.getByText('۴ از ۴',{exact:true}).waitFor();
    await page.getByRole('button',{name:'حذف آخرین نقطه'}).click();
    await page.getByText('۳ از ۴',{exact:true}).waitFor();
    await map.click({position:{x:80,y:210}});
    await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).click();
    await page.getByText('محدوده ذخیره شد.',{exact:true}).waitFor();
    assert.equal(geofenceWrites[0].body.boundary_points.length,4);
    await page.getByRole('button',{name:'شروع دوباره'}).click();
    for(const [x,y] of [[70,70],[200,210],[70,210],[200,70]]) await map.click({position:{x,y}});
    assert.equal(await page.getByRole('button',{name:'ذخیره محدوده',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:/اعلان‌ها/}).click();
    const panel=page.locator('.notification-panel');
    await panel.waitFor();
    assert.equal(await page.locator('.notification-list').evaluate(el=>el.scrollHeight>el.clientHeight),true);
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
