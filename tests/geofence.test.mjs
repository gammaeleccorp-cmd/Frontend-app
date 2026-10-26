import { test } from "node:test";
import assert from "node:assert/strict";
import { validCenter, validFence, crossedFence } from "../src/utils/geofence.mjs";

test("rejects missing/out-of-range coordinates and invalid radius", () => {
  for (const center of [null, [NaN, 51], [91, 51], [35, 181], ["35", 51]]) assert.equal(validCenter(center), false);
  for (const radius of ["", 49, 50001, 50.5, Infinity]) assert.equal(validFence([35, 51], radius), false);
  for (const radius of [50, "500", 50000]) assert.equal(validFence([35, 51], radius), true);
  assert.equal(validFence([0, 0], 50), true);
});

test("only fresh transitions on unchanged active fences notify", () => {
  const old = { is_active: true, latitude: 35, longitude: 51, radius_m: 500, position: "INSIDE", last_recorded_at: "2026-10-24T10:00:00Z" };
  const next = { ...old, position: "OUTSIDE", last_recorded_at: "2026-10-24T10:01:00Z" };
  assert.equal(crossedFence(old, next), true);
  assert.equal(crossedFence(next, { ...next, position: "INSIDE", last_recorded_at: "2026-10-24T10:02:00Z" }), true);
  for (const before of [null, { ...old, position: "UNKNOWN" }, { ...old, is_active: false }, { ...old, radius_m: 600 }]) assert.equal(crossedFence(before, next), false);
  for (const after of [{ ...next, last_recorded_at: old.last_recorded_at }, { ...next, last_recorded_at: null }, { ...next, position: "INSIDE" }, { ...next, latitude: 36 }]) assert.equal(crossedFence(old, after), false);
});
