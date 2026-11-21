import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_INTERVALS, pointsWithinInterval } from '../src/utils/historyInterval.mjs';

test('rolling history intervals use current time, include the boundary and exclude future points', () => {
  const now = Date.parse('2026-11-21T12:00:00Z');
  const point = (age) => ({ id: age, recordedAt: new Date(now - age * 3600000).toISOString() });
  const points = [-1, 0, 8, 12, 24, 48, 168, 169].map(point);
  for (const { hours } of HISTORY_INTERVALS) {
    assert.deepEqual(pointsWithinInterval(points, hours, now).map(p => p.id), [0, 8, 12, 24, 48, 168].filter(age => age <= hours));
  }
  assert.deepEqual(pointsWithinInterval([point(8)], 8, now + 1), []);
  assert.deepEqual(pointsWithinInterval([{ recordedAt: null }, { recordedAt: 'bad' }], 24, now), []);
  assert.equal(points.length, 8);
});
