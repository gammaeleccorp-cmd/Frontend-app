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
    page.on("pageerror", e => pageErrors.push(e.message));

    await page.route("https://api.gamma-tech.ir/**", async route => {
      const path = new URL(route.request().url()).pathname;
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
        data = { configured: false, is_active: false, position: "UNKNOWN" };
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
    await page.getByRole("button", { name: "تنظیم محدوده" }).waitFor();

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
