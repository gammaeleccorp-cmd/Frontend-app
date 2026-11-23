export function polygonError(points, vertexCount = 4) {
  if (![4,6].includes(vertexCount)) return "تعداد نقاط پشتیبانی نمی‌شود.";
  if (points.length !== vertexCount) return `${vertexCount === 6 ? "شش" : "چهار"} نقطه روی نقشه انتخاب کنید.`;
  if (!points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) return "مختصات انتخاب‌شده معتبر نیستند.";
  if (new Set(points.map(p => p.join(","))).size !== vertexCount) return "نقاط باید متمایز باشند.";
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const onSegment = (a,b,p) => Math.min(a[0],b[0]) <= p[0] && p[0] <= Math.max(a[0],b[0]) && Math.min(a[1],b[1]) <= p[1] && p[1] <= Math.max(a[1],b[1]);
  const intersects = (a,b,c,d) => {
    const x=cross(a,b,c), y=cross(a,b,d), z=cross(c,d,a), w=cross(c,d,b);
    return (x*y < 0 && z*w < 0) || (x===0 && onSegment(a,b,c)) || (y===0 && onSegment(a,b,d)) || (z===0 && onSegment(c,d,a)) || (w===0 && onSegment(c,d,b));
  };
  for(let i=0;i<vertexCount;i++) for(let j=i+1;j<vertexCount;j++) {
    if (j===i+1 || (i===0 && j===vertexCount-1)) continue;
    if (intersects(points[i],points[(i+1)%vertexCount],points[j],points[(j+1)%vertexCount])) return "شکل متقاطع است؛ خط‌های محدوده نباید یکدیگر را قطع کنند.";
  }
  const area=points.reduce((sum,p,i) => {const q=points[(i+1)%vertexCount];return sum+p[0]*q[1]-q[0]*p[1];},0);
  if (Math.abs(area)<1e-12) return "مساحت محدوده باید بیشتر از صفر باشد.";
  return "";
}
export function recentRecordedPoints(history = [], limit = 100) {
  return history.filter(p => Array.isArray(p.coordinates) && p.coordinates.length === 2 && p.coordinates.every(Number.isFinite) && Math.abs(p.coordinates[0]) <= 90 && Math.abs(p.coordinates[1]) <= 180 && p.coordinates.some(v => v !== 0) && Number.isFinite(Date.parse(p.recordedAt))).sort((a,b) => Date.parse(b.recordedAt)-Date.parse(a.recordedAt)).slice(0, limit);
}
export function latestPosition(history = []) {
  return recentRecordedPoints(history, 1)[0];
}
export const neshanUrl = point => `https://nshn.ir/?lat=${encodeURIComponent(point[0])}&lng=${encodeURIComponent(point[1])}`;
export const neshanRouteUrl = (origin, destination, vehicle = 'd') => `https://nshn.ir?origin=${encodeURIComponent(origin.join(','))}&destination=${encodeURIComponent(destination.join(','))}&vehicle=${vehicle === 'm' ? 'm' : 'd'}`;
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
