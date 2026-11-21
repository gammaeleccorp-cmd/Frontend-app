import test from 'node:test';
import assert from 'node:assert/strict';
import { paginatedHistory } from '../src/utils/paginatedHistory.mjs';

const path = '/api/v1/telemetry/devices/NG-0001/history/';
const base = 'https://api.gamma-tech.ir';
test('history collects all advertised pages and supports unpaginated arrays', async () => {
  const calls = [];
  const pages = [
    { results: Array.from({ length: 100 }, (_, id) => ({ id })), next: `${base}${path}?page=2` },
    { results: [{ id: 100 }], next: '?page=3' },
    { results: [{ id: 101 }], next: null },
  ];
  const records = await paginatedHistory(path, async url => { calls.push(url); return pages.shift(); }, base);
  assert.equal(records.length, 102);
  assert.deepEqual(calls, [path, `${path}?page=2`, `${path}?page=3`]);
  assert.deepEqual(await paginatedHistory(path, async () => [{ id: 1 }], base), [{ id: 1 }]);
  assert.deepEqual(await paginatedHistory(path, async () => ({ data: [] }), base), []);
});
test('history rejects cycles, unexpected destinations and partial failures', async () => {
  for (const next of [path, 'https://other.example/history/', '/api/v1/devices/']) {
    let calls = 0;
    await assert.rejects(paginatedHistory(path, async () => { calls++; return { results: [], next }; }, base));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(paginatedHistory(path, async () => {
    if (++calls === 2) throw new Error('network failure');
    return { results: [{ id: 1 }], next: '?page=2' };
  }, base), /network failure/);
  await assert.rejects(paginatedHistory(path, async () => ({}), base));
});
