import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

const user = { firstName: "پوریا", lastName: "آزمایشی", mobile: "09120000000", nationalId: "0012345678", birthDate: "1995-03-21" };
const noop = () => {};

let vite;
const load = (path) => vite.ssrLoadModule(path);
test.before(async () => { vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" }); });
test.after(async () => { await vite?.close(); });

function json(payload, status = 200, type = "application/json") {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status, headers: { "content-type": type } });
}

test("start screen welcomes a user without a device and reuses /add-device", async () => {
  const { default: WelcomeStartPage } = await load("/src/pages/WelcomeStartPage.jsx");
  const html = renderToStaticMarkup(createElement(WelcomeStartPage, { onStart: noop }));
  assert.match(html, /به گاما خوش آمدید/);
  assert.match(html, /برای شروع ردیابی، روی دکمهٔ زیر بزنید و اطلاعات محصول خود را وارد کنید\./);
  assert.match(html, /<button[^>]*>شروع ردیابی<\/button>/);

  const { default: DeviceOnboardingPage } = await load("/src/pages/DeviceOnboardingPage.jsx");
  const form = renderToStaticMarkup(createElement(DeviceOnboardingPage, { onSubmit: noop, onBack: noop }));
  assert.match(form, /اطلاعات محصول/);
  assert.match(form, /placeholder="NG-XXXX"/);
  assert.doesNotMatch(form, /VIN/i);
  assert.doesNotMatch(form, /required/);

  // App.jsx cannot be SSR-loaded (react-router CJS); assert the wiring in source instead.
  const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /if \(!data\.devices\?\.length\) return <WelcomeStartPage onStart=\{\(\) => navigate\("\/add-device"\)\} \/>/);
  assert.match(appSource, /<Route path="\/add-device" element=\{<AddDeviceRoute \/>\} \/>/);
  assert.match(appSource, /<HomePage product=\{product\} data=\{data\}/, "dashboard for users with devices is kept");
});

test("device code keeps NG-XXXX format, Persian digits and zero padding", async () => {
  const { normalizeDeviceCode } = await load("/src/services/gammaRepository.js");
  assert.equal(normalizeDeviceCode("ng-۱"), "NG-0001");
  assert.equal(normalizeDeviceCode("NG_42"), "NG-0042");
  assert.equal(normalizeDeviceCode("RH-۰۰۷"), "RH-0007");
  assert.equal(normalizeDeviceCode("WVWZZZ1JZXW000001"), "");
  assert.equal(normalizeDeviceCode("NG-12345"), "");
});

test("profile is a collapsed bar first, readable on open, editable via ویرایش", async () => {
  const { default: ProfilePage, connectionMessage } = await load("/src/pages/ProfilePage.jsx");
  const props = { user, onBack: noop, onLogout: noop, onTestBackend: noop, onUpdate: noop };

  const closed = renderToStaticMarkup(createElement(ProfilePage, props));
  assert.match(closed, /aria-expanded="false"/);
  assert.match(closed, /پوریا آزمایشی/);
  assert.match(closed, /ویرایش/);
  assert.doesNotMatch(closed, /<form/);
  assert.doesNotMatch(closed, /<input/);
  assert.doesNotMatch(closed, /0012345678/);

  const details = renderToStaticMarkup(createElement(ProfilePage, { ...props, defaultView: "details" }));
  assert.match(details, /aria-expanded="true"/);
  assert.match(details, /<dl/);
  assert.match(details, /1374\/01\/01/);
  assert.doesNotMatch(details, /0012345678/);
  assert.doesNotMatch(details, /<input/);

  const edit = renderToStaticMarkup(createElement(ProfilePage, { ...props, defaultView: "edit" }));
  assert.match(edit, /<form/);
  assert.match(edit, /value="1374\/01\/01"/);
  assert.match(edit, /id="mobile"[^>]*readonly=""/);
  assert.doesNotMatch(edit, /id="national-id"/);
  assert.match(edit, />ذخیره</);
  assert.match(edit, />انصراف</);

  for (const html of [closed, details, edit]) {
    assert.match(html, /بررسی اتصال/);
    assert.doesNotMatch(html, /Backend|HTTP/);
    assert.doesNotMatch(html, /کد ملی|0012345678/);
  }
  for (const reason of ["unavailable", "invalid_response", "unhealthy", "network", "timeout"]) {
    const message = connectionMessage({ healthy: false, reason, status: 503 });
    assert.doesNotMatch(message, /\d|HTTP|Backend/);
    assert.notEqual(message, connectionMessage({ healthy: true }));
  }
});

test("health check is green only for 2xx JSON with status healthy", async () => {
  const { probeBackend } = await load("/src/api/client.js");
  const { endpoints } = await load("/src/config/endpoints.js");
  assert.equal(endpoints.health.ready, "/api/v1/health/ready/");
  const originalFetch = globalThis.fetch;
  const urls = [];
  const cases = [
    ["healthy JSON", async () => json({ status: "healthy" }), true, "healthy"],
    ["404", async () => json({ detail: "Not found" }, 404), false, "unavailable"],
    ["500", async () => json("Server Error", 500, "text/html"), false, "unavailable"],
    ["503 healthy-looking", async () => json({ status: "healthy" }, 503), false, "unavailable"],
    ["HTML 200", async () => json("<!doctype html><html></html>", 200, "text/html"), false, "invalid_response"],
    ["unhealthy JSON", async () => json({ status: "unhealthy", checks: { db: "down" } }), false, "unhealthy"],
    ["degraded JSON", async () => json({ status: "degraded" }), false, "unhealthy"],
    ["network", async () => { throw new TypeError("Failed to fetch"); }, false, "network"],
    ["timeout", (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))), false, "timeout"],
  ];
  try {
    for (const [name, impl, healthy, reason] of cases) {
      globalThis.fetch = (url, init) => { urls.push(String(url)); return impl(url, init); };
      const result = await probeBackend({ timeoutMs: 30 });
      assert.equal(result.healthy, healthy, name);
      assert.equal(result.reason, reason, name);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(urls.every((url) => url.endsWith("/api/v1/health/ready/")));
});

test("Negahban telemetry never produces DTC/ECU data; Rahban keeps ECU", async () => {
  const repo = await load("/src/services/gammaRepository.js");
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  let device = { device_code: "NG-0001", product_type: "NEGAHBAN" };
  globalThis.localStorage = { getItem: () => "test-token" };
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/vehicles/") return json([]);
    if (path === "/api/v1/devices/") return json([device]);
    if (path.endsWith("/history/")) return json([]);
    if (path.endsWith("/latest/")) return json({ speed: 12, battery_voltage: 12.6, odometer: 1000, dtc_count: 3, rpm: 900, recorded_at: "2026-10-06T09:00:00Z" });
    return json({ first_name: "آزمایش", mobile: "09120000000" });
  };
  try {
    const negahban = await repo.getBootstrapData();
    const labels = negahban.negahbanMetrics.map((item) => item.label);
    assert.deepEqual(labels, ["سرعت", "ولتاژ باتری", "کیلومترشمار"]);
    assert.ok(!JSON.stringify(negahban.negahbanMetrics).includes("خطا"));
    assert.deepEqual(negahban.dtcs, []);
    assert.deepEqual(negahban.ecuParameters, []);

    device = { device_code: "RH-0001", product_type: "RAHBAN" };
    const rahban = await repo.getBootstrapData();
    assert.ok(rahban.ecuParameters.some((item) => item.label === "Engine RPM"));
    assert.ok(rahban.luminenMetrics.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});
