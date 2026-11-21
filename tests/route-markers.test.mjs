import test from 'node:test';
import assert from 'node:assert/strict';
import { routeMarkers, recordedSpeed, validHeading } from '../src/utils/routeMarkers.mjs';
import { normalizeTelemetryHistory } from '../src/utils/telemetry.mjs';

const first = { id: 1, recordedAt: '2026-11-21T09:00:00Z', coordinates: [35.7, 51.3], speed: 0 };
const last = { id: 2, recordedAt: '2026-11-21T10:00:00Z', coordinates: [35.8, 51.4], heading: 90, speed: 45 };

test('markers use chronological valid records without mutating the route or truncating the start', () => {
  const invalid = [{ ...last, coordinates: [999, 51] }, { ...last, recordedAt: null }, { ...last, coordinates: [0, 0] }];
  const history = [last, ...invalid, first];
  const copy = structuredClone(history);
  const markers = routeMarkers(history);
  assert.deepEqual(markers.map(marker => [marker.kind, marker.point.id]), [['start', 1], ['end', 2]]);
  assert.equal(markers[1].heading, 90);
  assert.strictEqual(markers[0].point.coordinates, first.coordinates);
  assert.strictEqual(markers[1].point.coordinates, last.coordinates);
  assert.deepEqual(history, copy);
  const many = Array.from({ length: 150 }, (_, id) => ({ ...last, id, recordedAt: new Date(Date.parse(first.recordedAt) + id * 1000).toISOString() }));
  many[0] = first;
  assert.equal(routeMarkers(many)[0].point.id, first.id);
  assert.deepEqual(routeMarkers([]), []);
  assert.deepEqual(routeMarkers(invalid), []);
});

test('single-point and closed routes use one orange car and identify the green start', () => {
  for (const history of [[first], [first, { ...last, coordinates: [...first.coordinates] }]]) {
    const markers = routeMarkers(history);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].kind, 'end');
    assert.equal(markers[0].includesStart, true);
    assert.match(markers[0].label, /شروع و پایان/);
    assert.equal(markers[0].points.length, history.length);
    assert.deepEqual(markers[0].points.map(point => point.recordedAt), history.map(point => point.recordedAt));
  }
  assert.equal(routeMarkers([first])[0].heading, null);
});

test('heading and speed distinguish absent values from valid zero', () => {
  for (const value of [undefined, null, '', ' ', NaN, Infinity, -1, {}, true, false]) {
    assert.equal(validHeading(value), null);
    assert.equal(recordedSpeed(value), null);
  }
  for (const value of [0, '0', 90, '270.5', 359]) assert.equal(validHeading(value), Number(value));
  assert.equal(validHeading(360), 0);
  assert.equal(validHeading(361), null);
  assert.equal(recordedSpeed(0), 0);
  assert.equal(recordedSpeed('3.96'), 3.96);
  assert.equal(routeMarkers([{ ...first, heading: '' }])[0].heading, null);
});

test('telemetry normalization carries recorded heading and speed to route markers', () => {
  const { routeHistory } = normalizeTelemetryHistory([
    { id: 2, recorded_at: last.recordedAt, latitude: 35.8, longitude: 51.4, speed: 0, heading: 180 },
    { id: 1, recorded_at: first.recordedAt, latitude: 35.7, longitude: 51.3 },
  ]);
  const markers = routeMarkers(routeHistory);
  assert.equal(markers[1].heading, 180);
  assert.equal(markers[1].point.speed, 0);
  assert.equal(markers[0].point.speed, undefined);
});
