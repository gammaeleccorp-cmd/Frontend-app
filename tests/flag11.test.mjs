import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
test.before(async () => { vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" }); });
test.after(async () => { await vite?.close(); });

const json = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });

test("bootstrap maps ACC, crash telemetry and the in-app notification feed", async () => {
  const repo = await vite.ssrLoadModule("/src/services/gammaRepository.js");
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "test-token" };
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/vehicles/") return json([]);
    if (path === "/api/v1/devices/") return json([{ device_code: "NG-0001", product_type: "NEGAHBAN", vehicle_id: null }]);
    if (path.endsWith("/latest/")) return json({ id: "t2", speed: 12, device_status: 1, recorded_at: "2026-10-19T09:00:00Z" });
    if (path.endsWith("/history/")) return json([{ id: "t1", event: "crash", impact_g: 2.35, speed: 42, latitude: 35.7, longitude: 51.4, recorded_at: "2026-10-19T08:59:00Z" }]);
    if (path === "/api/v1/notifications/") return json({ unread_count: 1, items: [{ id: "crash-t1", tone: "error", title: "هشدار تصادف", body: "شدت ضربه 2.35 g", created_at: "2026-10-19T08:59:00Z", read: false }] });
    return json({ first_name: "پوریا", mobile: "09120000000" });
  };
  try {
    const data = await repo.getBootstrapData();
    assert.deepEqual(data.negahbanMetrics.find((item) => item.label === "وضعیت ACC")?.value, "روشن");
    assert.deepEqual([data.mpuEvents[0].type, data.mpuEvents[0].level], ["تصادف", "2.35 g"]);
    assert.equal(data.notifications.unread_count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test("header badge and crash details are visible inside the app", async () => {
  const { default: Header } = await vite.ssrLoadModule("/src/components/AccessAppHeader.jsx");
  const { default: HomePage } = await vite.ssrLoadModule("/src/pages/HomePage.jsx");
  const { default: MpuPage } = await vite.ssrLoadModule("/src/pages/MpuPage.jsx");
  const crash = { id: "t1", type: "تصادف", level: "2.35 g", time: "امروز ۱۲:۲۹", speed: 42, latitude: 35.7, longitude: 51.4 };
  const header = renderToStaticMarkup(createElement(Header, { product: "NEGAHBAN", notifications: { unread_count: 1, items: [] } }));
  assert.match(header, /اعلان‌ها، 1 خوانده‌نشده/);
  const home = renderToStaticMarkup(createElement(HomePage, { product: "NEGAHBAN", now: Date.now(), onNavigate() {}, data: { vehicle: { deviceCode: "NG-0001" }, latestTelemetry: { device_status: 1 }, negahbanMetrics: [], mpuEvents: [crash], routeHistory: [] } }));
  assert.match(home, /هشدار تصادف ثبت شد/);
  assert.match(home, /2.35 g/);
  const events = renderToStaticMarkup(createElement(MpuPage, { events: [crash], onBack() {} }));
  assert.match(events, /تصادف ثبت‌شده/);
  assert.match(events, /google.com\/maps\?q=35.7,51.4/);
});
