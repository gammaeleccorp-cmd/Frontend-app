import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

// Separate process (node --test runs one file per process), so the mock flag stays isolated.
process.env.VITE_USE_MOCK_API = "true";

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

test("mock mode: Negahban-only account has no DTC/ECU, Rahban features stay", async () => {
  globalThis.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
  try {
    const repo = await vite.ssrLoadModule("/src/services/gammaRepository.js");
    assert.equal(repo.runtime.useMockApi, true);

    await repo.verifyOtp({ mobile: "09120000001", code: "12345" });
    const negahban = await repo.getBootstrapData();
    assert.deepEqual(negahban.allowedProducts, ["NEGAHBAN"]);
    assert.deepEqual(negahban.dtcs, []);
    assert.deepEqual(negahban.ecuParameters, []);
    assert.ok(!negahban.negahbanMetrics.some((item) => /خطا|DTC/i.test(item.label)));

    await repo.verifyOtp({ mobile: "09120000002", code: "12345" });
    const rahban = await repo.getBootstrapData();
    assert.ok(rahban.dtcs.length > 0);
    assert.ok(rahban.ecuParameters.length > 0);

    await repo.verifyOtp({ mobile: "09120000003", code: "12345" });
    const both = await repo.getBootstrapData();
    assert.ok(both.dtcs.length > 0, "dual-product account keeps Rahban diagnostics");

    const health = await repo.testBackendConnection();
    assert.equal(health.healthy, true);
    assert.equal(health.mock, true);
  } finally {
    await vite.close();
  }
});
