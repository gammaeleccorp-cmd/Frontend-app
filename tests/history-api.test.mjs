import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('device history sends the selected recorded_at range and follows every page', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const calls = [];
  const controller = new AbortController();
  globalThis.localStorage = { getItem: () => 'test-token' };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), signal: options.signal });
    const page = new URL(url).searchParams.get('page');
    const payload = page
      ? { results: [{ id: 101 }], next: null }
      : { results: Array.from({ length: 100 }, (_, id) => ({ id: id + 1 })), next: `${new URL(url).origin}${new URL(url).pathname}?page=2` };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { getDeviceTelemetryHistory } = await vite.ssrLoadModule('/src/api/gammaApi.js');
    const range = { start: '2026-11-14T12:00:00.000Z', end: '2026-11-21T12:00:00.000Z', signal: controller.signal };
    const records = await getDeviceTelemetryHistory('NG-0001', range);
    assert.equal(records.length, 101);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.pathname, '/api/v1/telemetry/devices/NG-0001/history/');
    assert.equal(calls[0].url.searchParams.get('start'), range.start);
    assert.equal(calls[0].url.searchParams.get('end'), range.end);
    assert.equal(calls[1].url.searchParams.get('page'), '2');
    assert.ok(calls.every(call => call.signal === controller.signal));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    await vite.close();
  }
});
