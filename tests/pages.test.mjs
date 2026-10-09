import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("Negahban pages render without a vehicle or fresh telemetry", async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const [{ default: HomePage }, { default: VehiclePage }, { default: ProfilePage }, repo] = await Promise.all([
      vite.ssrLoadModule("/src/pages/HomePage.jsx"),
      vite.ssrLoadModule("/src/pages/VehiclePage.jsx"),
      vite.ssrLoadModule("/src/pages/ProfilePage.jsx"),
      vite.ssrLoadModule("/src/services/gammaRepository.js"),
    ]);
    const data = {
      vehicle: { deviceCode: "NG-0001", lastSeen: "2026-10-07T09:00:00Z" },
      latestTelemetry: { speed: 0, recorded_at: "2026-10-07T09:00:00Z" },
      negahbanMetrics: [{ label: "سرعت", value: "0", unit: "km/h", icon: "gauge" }],
      routeHistory: [], routePoints: [], connection: {}, lastLocation: null,
    };
    const home = renderToStaticMarkup(createElement(HomePage, { product: "NEGAHBAN", data, now: Date.parse("2026-10-07T10:00:00Z"), onNavigate() {} }));
    assert.match(home, /NG-0001/);
    assert.match(home, /داده تازه دریافت نشده/);
    assert.match(home, /مشاهده نقشه و مسیرها/);

    const vehicle = renderToStaticMarkup(createElement(VehiclePage, { product: "NEGAHBAN", data, now: Date.parse("2026-10-07T10:00:00Z"), onBack() {}, onRoutes() {} }));
    assert.match(vehicle, /ثبت خودرو اختیاری است/);
    assert.match(vehicle, /NG-0001/);

    const profile = renderToStaticMarkup(createElement(ProfilePage, { user: { firstName: "آزمایش", mobile: "09120000000", birthDate: "1995-03-21" }, onBack() {}, onLogout() {}, onTestBackend() {}, onUpdate() {} }));
    assert.match(profile, /تست اتصال Backend/);
    assert.doesNotMatch(profile, /در نسخه فعلی در دسترس نیست/);
    assert.match(profile, /readonly=""/);

    const originalFetch = globalThis.fetch;
    const originalStorage = globalThis.localStorage;
    const calls = [];
    let vehicles = [];
    globalThis.localStorage = { getItem: () => "test-token" };
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      const path = new URL(url).pathname;
      if (path.includes("/vehicles/") && path.includes("/telemetry/")) throw new Error("Vehicle telemetry must not be requested");
      const payload = path === "/api/v1/vehicles/" ? vehicles
        : path === "/api/v1/devices/" ? [{ device_code: "NG-0001", product_type: "NEGAHBAN", online: true, last_seen: "2026-10-06T09:00:00Z" }]
          : path.endsWith("/history/") ? [{ id: 1, latitude: 35.70857, longitude: 51.37728, recorded_at: "2026-10-06T09:00:00Z" }]
            : path.endsWith("/latest/") ? { speed: 0, recorded_at: "2026-10-06T09:00:00Z" }
              : { first_name: "آزمایش", mobile: "09120000000" };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      for (const registeredVehicles of [[], [{ id: 14, model: "دنا" }]]) {
        vehicles = registeredVehicles;
        const snapshot = await repo.getBootstrapData();
        assert.equal(snapshot.vehicle.deviceCode, "NG-0001");
        assert.deepEqual(snapshot.routePoints, [[35.70857, 51.37728]]);
        assert.equal(snapshot.negahbanStatus.online, false);
      }
      assert.equal(calls.filter((url) => url.includes("/telemetry/devices/NG-0001/")).length, 4);
      assert.equal(calls.filter((url) => url.includes("/telemetry/vehicles/")).length, 0);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.localStorage = originalStorage;
    }

  } finally {
    await vite.close();
  }
});
