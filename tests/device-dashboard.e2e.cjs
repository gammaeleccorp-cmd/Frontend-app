// Mobile end-to-end check of the device dashboard with a fully mocked API.
// Every request to the API is intercepted: no account, OTP, command or relay
// action ever reaches production or a real board.
// Run: npm run build && npx vite preview --port 5178 & node tests/device-dashboard.e2e.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const BASE = process.env.E2E_BASE || "http://127.0.0.1:5178";
const SHOTS = process.env.E2E_SHOTS || path.join(__dirname, "../../screenshots");
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const REFRESH = `${b64({ alg: "none" })}.${b64({ jti: "current-jti", user_id: "u1" })}.sig`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  const posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());

  const old = "2026-10-07T05:00:00Z";
  const state = {
    me: { first_name: "تست", last_name: "کاربر", mobile: "09111111111", national_id: null, birth_date: "1991-03-21", preferred_product: "NEGAHBAN", emergency_phone: "", vehicle: null },
    status: {
      device_code: "NG-0001", product_type: "NEGAHBAN", status: "ACTIVE", online: false, last_seen: old,
      online_timeout_seconds: 300, server_time: "2026-10-07T08:00:00Z", vehicle: null,
      latest_telemetry: { recorded_at: old, received_at: old, age_seconds: 10800, has_location: true, speed: 0, battery_voltage: 12.4 },
      location: { latitude: 35.7, longitude: 51.4, recorded_at: old, received_at: old, speed: 0, age_seconds: 10800, stale: true },
    },
    route: [{ latitude: 35.7, longitude: 51.4, recorded_at: old, received_at: old, speed: 0, session_id: "s1" }],
    commands: new Map(),
    notifications: { unread_count: 1, items: [{ id: "activation-1", kind: "device", tone: "success", title: "دستگاه NG-0001 به حساب شما متصل شد", body: "—", created_at: old, read: false }] },
    sessions: [{ id: 1, jti: "current-jti", created_at: old, expires_at: "2026-10-14T05:00:00Z" }, { id: 2, jti: "other", created_at: old, expires_at: "2026-10-14T05:00:00Z" }],
  };
  let commandSeq = 0;

  await page.route("https://api.gamma-tech.ir/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    if (method !== "GET") posts.push({ path: p, method, body });
    let status = 200;
    let data = {};
    if (p === "/api/v1/devices/") data = [{ id: "d1", device_code: "NG-0001", product_type: "NEGAHBAN", status: "ACTIVE", online: state.status.online, last_seen: state.status.last_seen }];
    else if (p === "/api/v1/auth/otp/me/" && method === "GET") data = state.me;
    else if (p === "/api/v1/auth/otp/me/" && method === "PATCH") {
      const { vehicle, ...rest } = body;
      state.me = { ...state.me, ...rest, birth_date: rest.birth_date || state.me.birth_date };
      if (vehicle) state.me.vehicle = { id: "v1", make: "", status: "PENDING", ...state.me.vehicle, ...vehicle, production_year: Number(vehicle.production_year) || null };
      data = state.me;
    } else if (p === "/api/v1/devices/NG-0001/status/") data = state.status;
    else if (p === "/api/v1/devices/NG-0001/telemetry/") data = state.route;
    else if (p === "/api/v1/commands/" && method === "POST") {
      assert.equal(body.device_code, "NG-0001");
      const pending = [...state.commands.values()].find((item) => item.outcome === "waiting" && item.group === group(body.command_type));
      if (pending) { status = 409; data = { detail: "busy", command: pending }; }
      else {
        const command = { id: `00000000-0000-0000-0000-00000000000${++commandSeq}`, command_type: body.command_type, outcome: "waiting", result: {}, polls: 0, group: group(body.command_type) };
        state.commands.set(command.id, command);
        status = 201; data = command;
      }
    } else if (p.startsWith("/api/v1/commands/")) {
      const command = state.commands.get(p.split("/")[4]);
      command.polls += 1;
      if (command.polls >= 2 && command.outcome === "waiting") {
        command.outcome = "success";
        command.result = command.command_type === "REQUEST_LIVE_DATA" ? { ok: true, gps: { fix: true, lat: 35.71, lon: 51.42 } } : { ok: true };
        if (command.command_type === "REQUEST_LIVE_DATA") {
          const now = "2026-10-07T08:01:00Z";
          state.status = { ...state.status, online: true, last_seen: now, server_time: now, location: { latitude: 35.71, longitude: 51.42, recorded_at: now, received_at: now, speed: 0, age_seconds: 1, stale: false } };
          state.route = [...state.route, { latitude: 35.71, longitude: 51.42, recorded_at: now, received_at: now, speed: 0, session_id: "cmd" }];
        }
      }
      data = command;
    } else if (p === "/api/v1/notifications/") data = state.notifications;
    else if (p === "/api/v1/notifications/read/") { state.notifications = { unread_count: 0, items: state.notifications.items.map((item) => ({ ...item, read: true })) }; data = { unread_count: 0 }; }
    else if (p === "/api/v1/auth/otp/sessions/") data = state.sessions;
    else if (p === "/api/v1/auth/otp/sessions/revoke-others/") { assert.equal(body.refresh, REFRESH); state.sessions = state.sessions.slice(0, 1); data = { revoked: 1 }; }
    else throw new Error(`Unexpected API ${method} ${p}`);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  });
  function group(type) { return type.startsWith("RELAY") ? "relay" : type; }

  await page.addInitScript((refresh) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("gamma_access_token", "isolated-test-access");
      localStorage.setItem("gamma_refresh_token", refresh);
      localStorage.setItem("gamma_product", "NEGAHBAN");
      sessionStorage.setItem("seeded", "1");
    }
  }, REFRESH);
  fs.mkdirSync(SHOTS, { recursive: true });

  // 1. Home: device without vehicle gets the full dashboard, stale data is labelled.
  await page.goto(`${BASE}/home`);
  await page.getByText("وضعیت ردیاب NG-0001").waitFor();
  assert.equal(await page.getByText("حساب شما آماده است").count(), 0);
  await page.getByText("موقعیت قدیمی").first().waitFor();
  assert.equal(await page.locator(".device-dot").getAttribute("class"), "device-dot is-offline");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(SHOTS, "home-before-check.png"), fullPage: true });

  // 2. Connection check: PING, then location; double tap sends only once.
  const checkButton = page.getByRole("button", { name: "بررسی اتصال و دریافت موقعیت" });
  await checkButton.click();
  await checkButton.click({ force: true }).catch(() => {});
  await page.getByText("موقعیت جدید دریافت شد").waitFor({ timeout: 30000 });
  const commandPosts = posts.filter((item) => item.path === "/api/v1/commands/").map((item) => item.body.command_type);
  assert.deepEqual(commandPosts, ["PING", "REQUEST_LIVE_DATA"]);
  await page.waitForFunction(() => document.querySelector(".device-dot")?.classList.contains("is-online"));
  await page.getByText("موقعیت به‌روز").first().waitFor();

  // 3. Relay with simulated answer: success only after the device result.
  await page.getByRole("button", { name: "روشن‌کردن رله" }).click();
  await page.getByRole("button", { name: "تأیید و ارسال" }).click();
  await page.getByText("فرمان ارسال شد؛ منتظر پاسخ دستگاه").waitFor();
  assert.equal(await page.getByRole("button", { name: "خاموش‌کردن رله" }).isDisabled(), true);
  await page.getByText("دستگاه اجرای فرمان را تأیید کرد").waitFor({ timeout: 30000 });
  assert.equal(posts.filter((item) => item.body?.command_type?.startsWith("RELAY")).length, 1);
  await page.screenshot({ path: path.join(SHOTS, "home-after-check.png"), fullPage: true });

  // 4. Routes map and vehicle tab.
  await page.getByRole("button", { name: "مسیرها", exact: true }).click();
  await page.locator(".device-map.leaflet-container").waitFor();
  await page.screenshot({ path: path.join(SHOTS, "routes.png"), fullPage: true });
  await page.getByRole("button", { name: "خودرو", exact: true }).click();
  await page.getByRole("button", { name: "تکمیل اطلاعات در پروفایل" }).click();
  await page.waitForURL("**/profile");
  await page.locator(".profile-form").waitFor();

  // 5. Profile: no dev badge, spacing, digit normalization, persistence after reload.
  assert.equal(await page.getByText("API Mode").count(), 0);
  const gap = await page.evaluate(() => document.querySelector(".profile-form").getBoundingClientRect().top - document.querySelector(".settings-list").getBoundingClientRect().bottom);
  assert.ok(gap >= 16, `settings/profile gap ${gap}`);
  await page.getByLabel("تلفن اضطراری").fill("+۹۸۹۱۲۰۰۰۰۰۹۹");
  await page.getByLabel("مدل خودرو").fill("دنا پلاس");
  await page.getByLabel("سال تولید").fill("۱۴۰۲");
  for (const label of ["تلفن اضطراری", "سال تولید", "تاریخ تولد (شمسی)"]) {
    const style = await page.getByLabel(label).evaluate((el) => ({ align: getComputedStyle(el).textAlign, dir: getComputedStyle(el).direction, color: getComputedStyle(el).color, placeholder: getComputedStyle(el, "::placeholder").color }));
    assert.equal(style.align, "center"); assert.equal(style.dir, "ltr"); assert.notEqual(style.color, style.placeholder);
  }
  assert.equal(await page.getByLabel("مدل خودرو").evaluate((el) => getComputedStyle(el).direction), "rtl");
  assert.equal(await page.getByLabel("سال تولید").inputValue(), "1402");
  const save = page.getByRole("button", { name: "ذخیره اطلاعات" });
  await save.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const overlap = await page.evaluate(() => {
    const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
    const logout = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("خروج از حساب")).getBoundingClientRect();
    return logout.bottom - nav.top;
  });
  assert.ok(overlap <= 0, `last button hidden under navigation by ${overlap}px`);
  await save.click();
  await page.getByText("اطلاعات در سرور ذخیره شد.").waitFor();
  const patch = posts.find((item) => item.method === "PATCH");
  assert.equal(patch.body.emergency_phone, "09120000099");
  assert.equal(patch.body.vehicle.production_year, "1402");
  assert.equal(patch.body.birth_date, "1991-03-21");
  await page.reload();
  await page.getByLabel("مدل خودرو").waitFor();
  assert.equal(await page.getByLabel("مدل خودرو").inputValue(), "دنا پلاس");
  assert.equal(await page.getByLabel("تلفن اضطراری").inputValue(), "09120000099");
  assert.equal(await page.getByLabel("تاریخ تولد (شمسی)").inputValue(), "1370/01/01");
  await page.screenshot({ path: path.join(SHOTS, "profile.png"), fullPage: true });

  // 6. Notifications, security, settings and support.
  assert.equal(await page.locator(".notification-count").textContent(), "۱");
  await page.getByRole("button", { name: /اعلان‌ها/ }).first().click();
  await page.waitForURL("**/notifications");
  await page.getByText("دستگاه NG-0001 به حساب شما متصل شد").waitFor();
  await page.getByRole("button", { name: "خواندن همه" }).click();
  await page.waitForFunction(() => !document.querySelector(".notification-count"));
  await page.goto(`${BASE}/security`);
  await page.getByText("همین دستگاه").waitFor();
  await page.getByRole("button", { name: "خروج از سایر نشست‌ها" }).click();
  await page.getByRole("button", { name: "تأیید", exact: true }).click();
  await page.getByText("نشست دیگر خارج شد").waitFor();
  await page.goto(`${BASE}/settings`);
  await page.getByText("خاموش (فقط دستی)").click();
  await page.getByText("متن بزرگ‌تر").click();
  await page.reload();
  await page.getByText("خاموش (فقط دستی)").waitFor();
  assert.equal(await page.locator('input[name="refresh"]:checked').evaluate((el) => el.parentElement.textContent), "خاموش (فقط دستی)");
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("large-text")), true);
  await page.goto(`${BASE}/support`);
  await page.getByText("کانال پشتیبانی هنوز در پیکربندی این نسخه تعریف نشده است.").waitFor();

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("device dashboard e2e: OK");
})().catch((error) => { console.error(error); process.exit(1); });
