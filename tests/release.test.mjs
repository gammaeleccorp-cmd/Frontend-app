import test from "node:test";
import assert from "node:assert/strict";
import { readRelease, releaseUrl } from "../src/utils/release.mjs";

test("release checks bypass caches and require a real frontend identity", async () => {
  const sha = "a".repeat(40);
  assert.equal(await readRelease(async (url, options) => {
    assert.equal(url, "/release.json");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "same-origin");
    return { ok: true, json: async () => ({ component: "frontend", source_commit: sha }) };
  }), sha);
  for (const value of [{}, { component: "backend", source_commit: sha }, { component: "frontend", source_commit: "unknown" }]) {
    await assert.rejects(readRelease(async () => ({ ok: true, json: async () => value })), /Invalid release/);
  }
  await assert.rejects(readRelease(async () => ({ ok: false })), /unavailable/);
  await assert.rejects(readRelease(async () => { throw new Error("offline"); }), /offline/);
});

test("an explicit update preserves the route, query and fragment while bypassing old HTML", () => {
  const url = new URL(releaseUrl("https://app.gamma-tech.ir/routes?device=NG-0001#map", "b".repeat(40)));
  assert.equal(url.pathname, "/routes");
  assert.equal(url.searchParams.get("device"), "NG-0001");
  assert.equal(url.searchParams.get("__gamma_release"), "b".repeat(40));
  assert.equal(url.hash, "#map");
});
