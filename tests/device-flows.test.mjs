// Simulated device answers only: these tests never reach a server or a board.
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMANDS,
  createCheckLimiter,
  describeCheckResult,
  locationFromResult,
  runConnectionCheck,
  startCommand,
  waitForCommand,
} from "../src/services/deviceCommands.js";
import { describeConnection, describeLocation } from "../src/state/liveDevice.js";

function fakeClock() {
  let time = 0;
  return { now: () => time, sleep: async (ms) => { time += ms; } };
}

// A scripted device: each command type answers with the given outcome/result
// after `polls` status requests.
function fakeApi({ answers, statuses, polls = 1 }) {
  const commands = new Map();
  const sent = [];
  let statusCalls = 0;
  let id = 0;
  return {
    sent,
    async sendDeviceCommand(code, type) {
      sent.push(type);
      const command = { id: `c${++id}`, command_type: type, outcome: "waiting", result: {}, polls: 0 };
      commands.set(command.id, command);
      return { ...command };
    },
    async getCommand(commandId) {
      const command = commands.get(commandId);
      command.polls += 1;
      const answer = answers[command.command_type];
      if (answer && command.polls >= polls) Object.assign(command, answer);
      return { ...command };
    },
    async getDeviceStatus() {
      const status = statuses[Math.min(statusCalls, statuses.length - 1)];
      statusCalls += 1;
      return status;
    },
  };
}

const EMPTY = { online: true, location: null, latest_telemetry: null };
const LOCATED = { online: true, location: { latitude: 35.7, longitude: 51.4, received_at: "2026-10-07T08:00:00Z", recorded_at: "2026-10-07T08:00:00Z", age_seconds: 3, stale: false } };

test("PING then location: a new fix is reported as located", async () => {
  const clock = fakeClock();
  const api = fakeApi({
    answers: { PING: { outcome: "success", result: { ok: true } }, REQUEST_LIVE_DATA: { outcome: "success", result: { gps: { fix: true, lat: 35.7, lon: 51.4 } } } },
    statuses: [EMPTY, LOCATED],
  });
  const phases = [];
  const result = await runConnectionCheck(api, "NG-0001", { ...clock, onPhase: (phase) => phases.push(phase) });
  assert.equal(result.kind, "located");
  assert.deepEqual(api.sent, [COMMANDS.PING, COMMANDS.LOCATION]);
  assert.deepEqual(phases, ["ping_sending", "ping_waiting", "location_sending", "location_waiting", "location_settling"]);
  assert.equal(describeCheckResult(result).tone, "success");
});

test("device answers without GPS fix", async () => {
  const clock = fakeClock();
  const api = fakeApi({
    answers: { PING: { outcome: "success" }, REQUEST_LIVE_DATA: { outcome: "success", result: { gps: { fix: false } } } },
    statuses: [EMPTY],
  });
  const result = await runConnectionCheck(api, "NG-0001", clock);
  assert.equal(result.kind, "no_gps");
  assert.equal(result.explicit, true);
  assert.match(describeCheckResult(result).text, /GPS/);
});

test("old location is not mistaken for a new one", async () => {
  const clock = fakeClock();
  const api = fakeApi({
    answers: { PING: { outcome: "success" }, REQUEST_LIVE_DATA: { outcome: "success", result: { ok: true } } },
    statuses: [LOCATED],
  });
  const result = await runConnectionCheck(api, "NG-0001", { ...clock, settleMs: 6000 });
  assert.equal(result.kind, "no_gps");
  assert.equal(result.explicit, false);
});

test("PING timeout stops before asking for location; PING alone never confirms position", async () => {
  const clock = fakeClock();
  const api = fakeApi({ answers: { PING: { outcome: "timeout" } }, statuses: [EMPTY], polls: 99 });
  const result = await runConnectionCheck(api, "NG-0001", { ...clock, commandTimeoutMs: 10000 });
  assert.equal(result.kind, "no_response");
  assert.deepEqual(api.sent, [COMMANDS.PING]);
});

test("location request without answer after a good PING", async () => {
  const clock = fakeClock();
  const api = fakeApi({ answers: { PING: { outcome: "success" }, REQUEST_LIVE_DATA: { outcome: "timeout" } }, statuses: [EMPTY] });
  const result = await runConnectionCheck(api, "NG-0001", clock);
  assert.equal(result.kind, "location_no_response");
  assert.equal(result.pingOk, true);
});

test("device error on PING", async () => {
  const clock = fakeClock();
  const api = fakeApi({ answers: { PING: { outcome: "device_error", result: { ok: false } } }, statuses: [EMPTY] });
  assert.equal((await runConnectionCheck(api, "NG-0001", clock)).kind, "device_error");
});

test("client-side timeout when the server never resolves", async () => {
  const clock = fakeClock();
  const api = fakeApi({ answers: {}, statuses: [EMPTY] });
  const command = await api.sendDeviceCommand("NG-0001", COMMANDS.RELAY_ON);
  const final = await waitForCommand(api, command, { ...clock, timeoutMs: 6000 });
  assert.equal(final.outcome, "timeout");
});

test("relay: success only after a valid simulated answer; 409 attaches instead of resending", async () => {
  const clock = fakeClock();
  const api = fakeApi({ answers: { RELAY_ON: { outcome: "success", result: { ok: true } } }, statuses: [EMPTY], polls: 2 });
  const { command } = await startCommand(api, "NG-0001", COMMANDS.RELAY_ON);
  assert.equal(command.outcome, "waiting");
  assert.equal((await waitForCommand(api, command, clock)).outcome, "success");

  const pending = { id: "p1", command_type: "RELAY_ON", outcome: "waiting" };
  const conflict = { sendDeviceCommand: async () => { throw Object.assign(new Error("busy"), { status: 409, payload: { command: pending } }); } };
  const attached = await startCommand(conflict, "NG-0001", COMMANDS.RELAY_OFF);
  assert.equal(attached.attached, true);
  assert.equal(attached.command.id, "p1");
  const failing = { sendDeviceCommand: async () => { throw Object.assign(new Error("rate"), { status: 429 }); } };
  await assert.rejects(startCommand(failing, "NG-0001", COMMANDS.RELAY_ON), /rate/);
});

test("repeated checks are limited", () => {
  let time = 0;
  const limiter = createCheckLimiter({ max: 2, windowMs: 60000, cooldownMs: 10000, now: () => time });
  assert.equal(limiter.check().ok, true); limiter.record();
  assert.equal(limiter.check().ok, false);
  time = 11000;
  assert.equal(limiter.check().ok, true); limiter.record();
  time = 30000;
  const blocked = limiter.check();
  assert.equal(blocked.ok, false);
  assert.ok(blocked.waitSeconds > 0);
  time = 61000;
  assert.equal(limiter.check().ok, true);
});

test("location result parsing matches backend rules", () => {
  assert.equal(locationFromResult({ ok: true }), null);
  assert.deepEqual(locationFromResult({ lat: 0, lon: 0 }), { hasFix: false });
  assert.deepEqual(locationFromResult({ location: { valid: "false" } }), { hasFix: false });
  assert.deepEqual(locationFromResult({ data: { latitude: "35.1", longitude: 51.2 } }), { hasFix: true, latitude: 35.1, longitude: 51.2 });
});

test("shared status text: online, offline with last time, never seen, no GPS, stale", () => {
  const base = { deviceCode: "NG-0001", loading: false, error: "" };
  assert.equal(describeConnection({ ...base, status: { online: true, server_time: "2026-10-07T08:00:10Z", last_seen: "2026-10-07T08:00:00Z" } }).tone, "online");
  const offline = describeConnection({ ...base, status: { online: false, server_time: "2026-10-07T10:00:00Z", last_seen: "2026-10-07T08:00:00Z" } });
  assert.equal(offline.tone, "offline");
  assert.match(offline.detail, /ساعت پیش/);
  assert.equal(describeConnection({ ...base, status: { online: false, last_seen: null } }).label, "بدون داده");
  assert.equal(describeConnection({ ...base, status: null, error: "x" }).tone, "unknown");
  assert.equal(describeConnection({ ...base, deviceCode: "" }).label, "بدون دستگاه");
  assert.equal(describeLocation({ location: null, latest_telemetry: { has_location: false } }).state, "no_gps");
  assert.equal(describeLocation({ location: { ...LOCATED.location, stale: true, age_seconds: 7200 }, latest_telemetry: {} }).state, "stale");
  assert.equal(describeLocation({ location: null, latest_telemetry: null }).state, "none");
});
