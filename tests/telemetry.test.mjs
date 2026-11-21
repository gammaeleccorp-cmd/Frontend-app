import test from "node:test";
import assert from "node:assert/strict";
import { isTelemetryFresh, normalizeTelemetryHistory, switchState } from "../src/utils/telemetry.mjs";
import { isoToJalali, jalaliToIso } from "../src/utils/jalali.mjs";

test("an old online flag cannot make stale telemetry live", () => {
  const now = Date.parse("2026-10-07T10:00:00Z");
  assert.equal(isTelemetryFresh({ online: true, recorded_at: "2026-10-07T09:54:00Z" }, now), false);
  assert.equal(isTelemetryFresh({ received_at: "2026-10-07T09:57:00Z", recorded_at: "2026-10-06T10:00:00Z" }, now), true);
  assert.equal(isTelemetryFresh({ recorded_at: "2026-10-07T10:05:00Z" }, now), false);
  assert.equal(isTelemetryFresh(null, now), false);
});

test("device history becomes ordered valid Leaflet points", () => {
  const history = normalizeTelemetryHistory([
    { id: 2, recorded_at: "2026-10-07T09:02:00Z", latitude: "35.708570", longitude: "51.377280", speed: 0 },
    { id: 3, recorded_at: "2026-10-07T09:03:00Z", latitude: null, longitude: null },
    { id: 1, recorded_at: "2026-10-07T09:01:00Z", latitude: 35.7, longitude: 51.3 },
    { id: 4, latitude: 999, longitude: 51 },
  ]);
  assert.deepEqual(history.routePoints, [[35.7, 51.3], [35.70857, 51.37728]]);
  assert.equal(history.routeHistory[0].id, 2);
  assert.equal(history.routeHistory[0].speed, 0);
});

test("Jalali date round trip rejects invalid dates", () => {
  assert.equal(jalaliToIso("۱۴۰۲/۰۱/۰۱"), "2023-03-21");
  assert.equal(isoToJalali("2023-03-21"), "1402/01/01");
  assert.equal(jalaliToIso("1402/13/01"), "");
});

test("switch status expires with recorded state and cannot be revived by delayed contact", () => {
  const now = Date.parse("2026-11-21T10:00:00Z");
  const stamp = new Date(now).toISOString();
  for (const [state, expected] of [[1, "on"], [0, "off"], [null, "unknown"], [undefined, "unknown"]]) {
    const sample = { recorded_at: stamp, received_at: stamp, device_status: state };
    assert.equal(switchState(sample, now), expected);
    assert.equal(isTelemetryFresh(sample, now + 300000), true);
    assert.equal(isTelemetryFresh(sample, now + 300001), false);
    assert.equal(switchState(sample, now + 300001), "unknown");
  }
  assert.equal(switchState({ received_at: stamp, recorded_at: new Date(now - 360000).toISOString(), device_status: 1 }, now), "unknown");
  assert.equal(switchState({ received_at: stamp, device_status: 1 }, now), "unknown");
  assert.equal(switchState(null, now), "unknown");
});
