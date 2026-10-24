import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("merged dashboard retains ACC, crash details, inbox, and geofence API", async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const calls = [];
  let acc = 1;
  const crash = { id: 99, event: "crash", impact_g: 2.5, speed: 30, latitude: 35, longitude: 51, recorded_at: "2026-10-24T10:00:00Z" };
  const notification = { id: 1, title: "هشدار تصادف", body: "ضربه ثبت شد", tone: "error", read: false, created_at: crash.recorded_at };
  const configured = { configured: true, is_active: true, position: "INSIDE", latitude: 35, longitude: 51, radius_m: 500, last_recorded_at: crash.recorded_at };
  globalThis.localStorage = { getItem: () => "test-token" };
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: init.method || "GET", body: init.body, headers: init.headers });
    let value;
    if (path.endsWith("/geofence/")) {
      if (init.method === "DELETE") return new Response(null, { status: 204 });
      value = configured;
    } else if (path === "/api/v1/vehicles/") value = [];
    else if (path === "/api/v1/devices/") value = [{ device_code: "NG-0001", product_type: "NEGAHBAN" }];
    else if (path === "/api/v1/notifications/") value = { unread_count: 1, items: [notification] };
    else if (path === "/api/v1/notifications/read/") value = { unread_count: 0 };
    else if (path.endsWith("/history/")) value = [crash];
    else if (path.endsWith("/latest/")) value = { ...crash, event: "location", device_status: acc };
    else value = { first_name: "آزمایش", mobile: "09120000000" };
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const repo = await vite.ssrLoadModule("/src/services/gammaRepository.js");
    const { default: HomePage } = await vite.ssrLoadModule("/src/pages/HomePage.jsx");
    const { default: Header } = await vite.ssrLoadModule("/src/components/AccessAppHeader.jsx");
    const api = await vite.ssrLoadModule("/src/api/geofenceApi.js");
    for (const [raw, label] of [[1, "روشن"], [0, "خاموش"], [undefined, "نامشخص"]]) {
      acc = raw;
      const data = await repo.getBootstrapData();
      assert.equal(data.negahbanMetrics.find((item) => item.icon === "power").value, label);
      assert.equal(data.mpuEvents[0].level, "2.50 g");
      assert.equal(data.mpuEvents[0].latitude, 35);
      assert.equal(data.notifications.unread_count, 1);
      const html = renderToStaticMarkup(createElement(HomePage, { product: "NEGAHBAN", data, now: Date.parse(crash.recorded_at), geofence: { value: configured }, onNavigate() {} }));
      const pair = html.match(/<section class="metrics negahban-metrics status-metrics">([\s\S]*?)<\/section>/)?.[1];
      assert.ok(pair, "ACC and geofence share a dedicated row");
      assert.ok(pair.indexOf("وضعیت ACC") < pair.indexOf("محدوده جغرافیایی"));
      assert.match(pair, /داخل محدوده/);
      assert.match(html, /هشدار تصادف ثبت شد/);
      assert.match(html, /مشاهده جزئیات/);
      const header = renderToStaticMarkup(createElement(Header, { product: "NEGAHBAN", notifications: data.notifications }));
      assert.match(header, /notification-count/);
    }
    await repo.markNotificationsRead();
    assert.ok(calls.some((c) => c.path.endsWith("/notifications/read/") && c.method === "POST"));
    assert.equal((await api.getGeofence("NG-0001")).position, "INSIDE");
    await api.saveGeofence("NG-0001", { latitude: "35", longitude: "51", radius_m: "500" });
    const saved = calls.find((c) => c.path.endsWith("/geofence/") && c.method === "PUT");
    assert.deepEqual(JSON.parse(saved.body), { latitude: 35, longitude: 51, radius_m: 500 });
    assert.equal(saved.headers.Authorization, "Bearer test-token");
    await api.disableGeofence("NG-0001");
    assert.ok(calls.some((c) => c.path.endsWith("/geofence/") && c.method === "DELETE"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    await vite.close();
  }
});
