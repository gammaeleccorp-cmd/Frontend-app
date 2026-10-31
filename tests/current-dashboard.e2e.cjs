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
    let geofence = { configured: false, is_active: false, position: "UNKNOWN" };
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
      else if (path === "/api/v1/notifications/") data = { unread_count: 0, items: [] };
      else if (path === "/api/v1/telemetry/devices/NG-0001/latest/") data = null;
      else if (path === "/api/v1/telemetry/devices/NG-0001/history/") data = [];
      else if (path === "/api/v1/devices/NG-0001/geofence/") {
        if (method === "GET") data = geofence;
        else if (method === "PUT") {
          const body = request.postDataJSON();
          geofenceWrites.push({ method, body });
          geofence = { ...body, configured: true, is_active: true, position: "INSIDE", last_recorded_at: "2026-10-31T08:00:00Z" };
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
    await page.locator(".geofence-card").waitFor();
    await page.locator(".geofence-card button").click();
    await page.waitForURL("**/routes");

    const fields = page.locator('form input[type="number"]');
    await fields.nth(0).fill("35.7001");
    await fields.nth(1).fill("51.4002");
    await fields.nth(2).fill("500");
    await page.locator('form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('form button[type="button"]')?.disabled === false);
    assert.deepEqual(geofenceWrites[0], {
      method: "PUT",
      body: { latitude: 35.7001, longitude: 51.4002, radius_m: 500 },
    });

    // Editing sends the full replacement configuration.
    await fields.nth(0).fill("35.7101");
    await fields.nth(1).fill("51.4102");
    await fields.nth(2).fill("750");
    await page.locator('form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('form button[type="submit"]')?.disabled === false);
    assert.deepEqual(geofenceWrites[1], {
      method: "PUT",
      body: { latitude: 35.7101, longitude: 51.4102, radius_m: 750 },
    });

    // A newer transition on the unchanged active fence raises an in-app event.
    geofence = { ...geofence, position: "OUTSIDE", last_recorded_at: "2026-10-31T08:01:00Z" };
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const transitionToast = page.locator(".toast:not(.welcome-toast)");
    await transitionToast.waitFor();
    assert.match(await transitionToast.textContent(), /NG-0001/);

    await page.locator('form button[type="button"]').click();
    await page.waitForFunction(() => document.querySelector('form button[type="button"]')?.disabled === true);
    assert.deepEqual(geofenceWrites[2], { method: "DELETE" });
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
