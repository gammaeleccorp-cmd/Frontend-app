import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { describeCommand, relayStateFromCommand, commandErrorMessage, withinCommandDeadline } from "../src/utils/commands.mjs";
import { vehiclePayload, vehicleErrorMessage } from "../src/utils/vehicle.mjs";

const relay = (status, outcome, result = {}, type = "RELAY_ON") => ({ id: "c1", command_type: type, status, outcome, result });

test("SENT / ACKNOWLEDGED are never success; relay state only from a valid result", () => {
  assert.equal(describeCommand(relay("PENDING", "sending")).phase, "sending");
  for (const [status, phase] of [["SENT", "waiting"], ["ACKNOWLEDGED", "acknowledged"]]) {
    const view = describeCommand(relay(status, "waiting", { ok: true, relay: "ON" }));
    assert.equal(view.phase, phase);
    assert.equal(view.pending, true);
    assert.equal(view.relayState, null, "no state before COMPLETED + success");
  }
  const ok = describeCommand(relay("COMPLETED", "success", { ok: true, relay: "ON" }));
  assert.deepEqual([ok.phase, ok.tone, ok.relayState, ok.mismatch, ok.pending], ["success", "success", "ON", false, false]);
  assert.equal(relayStateFromCommand(relay("COMPLETED", "success", { relay_state: 0 }, "RELAY_OFF")), "OFF");
  const noState = describeCommand(relay("COMPLETED", "success", { ok: true }));
  assert.deepEqual([noState.tone, noState.relayState], ["warning", null]);
  assert.equal(relayStateFromCommand(relay("COMPLETED", "success", { relay: "maybe" })), null);
  assert.equal(relayStateFromCommand(relay("COMPLETED", "success", { relay_state: true })), null);
  assert.equal(describeCommand(relay("COMPLETED", "success", { relay: "OFF" })).mismatch, true);
  assert.equal(describeCommand(relay("COMPLETED", "success", { relay: "OFF" })).tone, "warning");
  const premature = describeCommand(relay("SENT", "success", { relay: "ON" }));
  assert.deepEqual([premature.phase, premature.relayState], ["unknown", null]);
  for (const outcome of ["device_error", "failed", "timeout"]) {
    const view = describeCommand(relay(outcome === "device_error" ? "COMPLETED" : outcome.toUpperCase(), outcome, { ok: false, relay: "ON" }));
    assert.equal(view.phase, outcome);
    assert.equal(view.tone, "error");
    assert.equal(view.relayState, null);
  }
  assert.equal(describeCommand(relay("COMPLETED", undefined, { relay: "ON" })).phase, "unknown", "missing outcome is not success");
  const late = describeCommand(relay("SENT", "waiting"), { clientTimedOut: true });
  assert.deepEqual([late.phase, late.pending, late.tone], ["client_timeout", false, "error"]);
  assert.doesNotMatch(commandErrorMessage({ status: 503, message: "خطای سرور (503)" }), /\d/);
  assert.doesNotMatch(commandErrorMessage({ status: 500, message: "خطای سرور (500)" }), /\d/);
});

test("a hung send or poll reaches the client deadline; a late result stays ignored", { timeout: 1000 }, async () => {
  let release;
  const stalled = new Promise((resolve) => { release = resolve; });
  let applied = false;
  const tracking = withinCommandDeadline(() => stalled, Date.now() + 20).then(() => { applied = true; });
  await assert.rejects(tracking, (error) => error.clientTimedOut === true);
  release(relay("COMPLETED", "success", { relay: "ON" }));
  await stalled;
  assert.equal(applied, false, "a late success must not update the relay view");

  const response = relay("SENT", "waiting");
  assert.equal(await withinCommandDeadline(() => Promise.resolve(response), Date.now() + 1000), response);
  let called = false;
  await assert.rejects(withinCommandDeadline(() => { called = true; return response; }, Date.now() - 1), (error) => error.clientTimedOut === true);
  assert.equal(called, false, "do not issue another poll after the overall deadline");
});

test("vehicle payload has no VIN, normalises Persian year and validates", () => {
  const { payload, errors } = vehiclePayload({ model: " پژو ۲۰۶ ", production_year: "۱۴۰۲", license_plate: "12ب345", vin: "WVWZZZ1JZXW000001" });
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { model: "پژو ۲۰۶", color: "", license_plate: "12ب345", production_year: 1402 });
  assert.ok(!("vin" in payload));
  assert.ok(vehiclePayload({}).errors.form);
  assert.deepEqual(vehiclePayload({}, { requireOne: false }).errors, {});
  assert.ok(vehiclePayload({ production_year: "2024" }).errors.production_year);
  assert.ok(vehiclePayload({ license_plate: "x".repeat(21) }).errors.license_plate);
  assert.equal(vehiclePayload({ model: "x", production_year: "" }).payload.production_year, null);
  assert.doesNotMatch(vehicleErrorMessage({ status: 400, message: "خطای سرور (400)" }), /\d/);
});

let vite;
test.before(async () => { vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" }); });
test.after(async () => { await vite?.close(); });

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

test("repository: register, edit, relay commands and strict device→vehicle link", async () => {
  const repo = await vite.ssrLoadModule("/src/services/gammaRepository.js");
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const calls = [];
  let device = { device_code: "NG-0001", product_type: "NEGAHBAN", vehicle_id: null };
  let commandResponse = () => json({ id: "cmd-1", command_type: "RELAY_ON", status: "SENT", outcome: "waiting" }, 201);
  globalThis.localStorage = { getItem: () => "test-token" };
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method: init.method || "GET", body });
    if (path === "/api/v1/devices/NG-0001/vehicle/") return json({ device_code: "NG-0001", vehicle: { id: "veh-1" } }, 201);
    if (path === "/api/v1/vehicles/veh-1/") return json({ id: "veh-1", ...body });
    if (path === "/api/v1/commands/") return commandResponse();
    if (path === "/api/v1/commands/cmd-1/") return json({ id: "cmd-1", command_type: "RELAY_ON", status: "COMPLETED", outcome: "success", result: { ok: true, relay: "ON" } });
    if (path === "/api/v1/vehicles/") return json([{ id: "other-vehicle", model: "دنا" }]);
    if (path === "/api/v1/devices/") return json([device]);
    if (path.endsWith("/history/")) return json([]);
    if (path.endsWith("/latest/")) return json({ speed: 0, recorded_at: "2026-10-14T09:00:00Z" });
    return json({ first_name: "آزمایش", mobile: "09120000000" });
  };
  try {
    await repo.registerDeviceVehicle("ng-۱", { model: "پژو", production_year: "۱۴۰۲", license_plate: "12ب345", vin: "X" });
    const create = calls.find((c) => c.path === "/api/v1/devices/NG-0001/vehicle/");
    assert.equal(create.method, "POST");
    assert.deepEqual(create.body, { model: "پژو", color: "", license_plate: "12ب345", production_year: 1402 });
    await assert.rejects(repo.registerDeviceVehicle("NG-0001", {}), /دست‌کم/);

    await repo.updateVehicle("veh-1", { model: "پژو", color: "سفید", production_year: "", license_plate: "" });
    const edit = calls.find((c) => c.path === "/api/v1/vehicles/veh-1/");
    assert.equal(edit.method, "PATCH");
    assert.equal(edit.body.production_year, null);
    assert.ok(!("vin" in edit.body));

    const sent = await repo.sendRelayCommand("NG-0001", "RELAY_ON");
    assert.equal(sent.existing, false);
    assert.deepEqual(calls.find((c) => c.path === "/api/v1/commands/").body, { device_code: "NG-0001", command_type: "RELAY_ON" });
    commandResponse = () => json({ detail: "busy", command: { id: "cmd-0", command_type: "RELAY_OFF", status: "SENT", outcome: "waiting" } }, 409);
    const inflight = await repo.sendRelayCommand("NG-0001", "RELAY_ON");
    assert.deepEqual([inflight.existing, inflight.command.id], [true, "cmd-0"]);
    commandResponse = () => json({ detail: "Too many commands." }, 429);
    await assert.rejects(repo.sendRelayCommand("NG-0001", "RELAY_OFF"), (error) => error.status === 429);
    await assert.rejects(repo.sendRelayCommand("NG-0001", "RESET"));
    assert.equal((await repo.getCommand("cmd-1")).outcome, "success");

    // Unlinked device: an unrelated vehicle of the account is not shown as this device's vehicle.
    const unlinked = await repo.getBootstrapData();
    assert.equal(unlinked.vehicle.deviceCode, "NG-0001");
    assert.equal(unlinked.vehicle.id, undefined);
    device = { ...device, vehicle_id: "other-vehicle" };
    const linked = await repo.getBootstrapData();
    assert.equal(linked.vehicle.id, "other-vehicle");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test("device page: optional vehicle button and relay control without vehicle", async () => {
  const { default: VehiclePage } = await vite.ssrLoadModule("/src/pages/VehiclePage.jsx");
  const data = { vehicle: { deviceCode: "NG-0001" }, latestTelemetry: null, lastLocation: null, routeHistory: [] };
  const props = { product: "NEGAHBAN", data, now: Date.now(), onBack() {}, onRoutes() {}, onUpdate() {}, onRegisterVehicle() {}, onSendRelay() {}, onPollCommand() {} };
  const html = renderToStaticMarkup(createElement(VehiclePage, props));
  assert.match(html, /ثبت اطلاعات خودرو — اختیاری/);
  assert.match(html, /کنترل رله/);
  assert.match(html, /وضعیت رله: نامشخص/);
  assert.match(html, /روشن کردن رله/);
  assert.match(html, /لزوماً به معنی روشن یا خاموش شدن موتور نیست/);
  assert.doesNotMatch(html, /VIN/i);

  const withVehicle = renderToStaticMarkup(createElement(VehiclePage, { ...props, data: { ...data, vehicle: { ...data.vehicle, id: "veh-1", model: "پژو", plate: "12ب345", color: "—", production_year: 1402 } } }));
  assert.match(withVehicle, /ویرایش اطلاعات خودرو/);
  assert.match(withVehicle, /value="1402"/);
  assert.doesNotMatch(withVehicle, /ثبت اطلاعات خودرو — اختیاری/);
  assert.match(withVehicle, /کنترل رله/, "relay stays available with a vehicle");
  assert.doesNotMatch(withVehicle, /VIN/i);
});
