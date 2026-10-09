import assert from 'node:assert/strict';
import test from 'node:test';
import { describeConnection } from '../src/state/liveDevice.js';
const base = { deviceCode: 'NG-0001', fetchedAt: 1000000, status: {
  online: true, online_timeout_seconds: 300,
  server_time: '2026-10-09T10:00:10Z', last_seen: '2026-10-09T13:30:00+03:30',
}};
test('cached online status expires without a new API response, using server age and elapsed client time', () => {
  assert.equal(describeConnection({ ...base, now: 1000000 }).tone, 'online');
  assert.equal(describeConnection({ ...base, now: 1290000 }).tone, 'online');
  assert.equal(describeConnection({ ...base, now: 1291000 }).tone, 'offline');
});
test('errors and invalid timestamps never present cached telemetry as online', () => {
  assert.notEqual(describeConnection({ ...base, now: 1000000, error: 'network unavailable' }).tone, 'online');
  assert.notEqual(describeConnection({ ...base, status: { ...base.status, last_seen: 'invalid' } }).tone, 'online');
});
