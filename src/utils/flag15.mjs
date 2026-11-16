export function polygonError(points) {
  if (points.length !== 4) return "چهار نقطه روی نقشه انتخاب کنید.";
  if (new Set(points.map(p => p.join(','))).size !== 4) return "نقاط باید متمایز باشند.";
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const intersects = (a,b,c,d) => cross(a,b,c)*cross(a,b,d) <= 0 && cross(c,d,a)*cross(c,d,b) <= 0;
  if (intersects(points[0],points[1],points[2],points[3]) || intersects(points[1],points[2],points[3],points[0])) return "ضلع‌های محدوده نباید یکدیگر را قطع کنند.";
  if (Math.abs(points.reduce((sum,p,i) => { const q=points[(i+1)%4]; return sum+p[0]*q[1]-q[0]*p[1]; },0)) < 1e-12) return "مساحت محدوده باید بیشتر از صفر باشد.";
  return "";
}
export function recentRecordedPoints(history = [], limit = 100) {
  return history.filter(p => Array.isArray(p.coordinates) && p.coordinates.length === 2 && p.coordinates.every(Number.isFinite) && Math.abs(p.coordinates[0]) <= 90 && Math.abs(p.coordinates[1]) <= 180 && p.coordinates.some(v => v !== 0) && Number.isFinite(Date.parse(p.recordedAt))).sort((a,b) => Date.parse(b.recordedAt)-Date.parse(a.recordedAt)).slice(0, limit);
}
export function latestPosition(history = []) {
  return recentRecordedPoints(history, 1)[0];
}
export const neshanUrl = point => `https://neshan.org/maps/@${point[0]},${point[1]},16z`;
export function liveSpeed(sample, now = Date.now()) {
 const time = Date.parse(sample?.recorded_at);
 if (!Number.isFinite(time) || now-time > 90000 || time > now+30000) return null;
 if (sample.device_status === 0 || sample.acc === false || sample.acc === 0 || sample.acc === "OFF") return 0;
 const value = sample.speed;
 return value != null && value !== '' && Number.isFinite(Number(value)) && Number(value)>=0 ? Number(value) : null;
}

export function newestSample(current, incoming) {
 const nextTime=Date.parse(incoming?.recorded_at);
 const previousTime=Date.parse(current?.recorded_at);
 return Number.isFinite(nextTime) && (!Number.isFinite(previousTime) || nextTime >= previousTime) ? incoming : current;
}
export function recordedPosition(data) {
 const telemetry=data.latestTelemetry;
 return latestPosition([...(data.routeHistory || []), ...(telemetry?.latitude != null && telemetry?.longitude != null ? [{coordinates:[Number(telemetry.latitude),Number(telemetry.longitude)],recordedAt:telemetry.recorded_at}] : [])]);
}
