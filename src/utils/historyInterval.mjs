export const HISTORY_INTERVALS = [
  { hours: 8, label: '۸ ساعت گذشته' },
  { hours: 12, label: '۱۲ ساعت گذشته' },
  { hours: 24, label: '۲۴ ساعت گذشته' },
  { hours: 48, label: '۴۸ ساعت گذشته' },
  { hours: 168, label: 'یک هفتهٔ گذشته' },
];

export function pointsWithinInterval(points, hours, now) {
  const start = now - hours * 60 * 60 * 1000;
  return points.filter(point => {
    const time = Date.parse(point.recordedAt);
    return time >= start && time <= now;
  });
}
