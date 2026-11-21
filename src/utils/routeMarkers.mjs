import { recentRecordedPoints } from './flag15.mjs';

export function validHeading(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const heading = Number(value);
  return Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading % 360 : null;
}

export function recordedSpeed(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const speed = Number(value);
  return Number.isFinite(speed) && speed >= 0 ? speed : null;
}

export function routeMarkers(history = []) {
  // Use the entire recorded history; the list's 100-row limit must not move
  // the actual start marker. Sorting works on a copy and preserves coordinates.
  const points = recentRecordedPoints(history, Infinity).reverse();
  if (!points.length) return [];
  const first = points[0], last = points.at(-1);
  const samePosition = first.coordinates.every((value, index) => value === last.coordinates[index]);
  const end = {
    kind: 'end', point: last, heading: validHeading(last.heading),
    includesStart: samePosition,
    points: samePosition && points.length > 1 ? [first, last] : [last],
    label: samePosition ? 'شروع و پایان مسیر — آخرین موقعیت خودرو' : 'پایان مسیر — آخرین موقعیت خودرو',
  };
  return samePosition ? [end] : [
    { kind: 'start', point: first, heading: null, includesStart: false, points: [first], label: 'شروع مسیر' },
    end,
  ];
}
