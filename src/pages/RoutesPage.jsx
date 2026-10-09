import { CalendarDays, MapPinned, Route } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import DeviceMap from "../components/DeviceMap";
import ConnectionCheck from "../components/ConnectionCheck";
import DeviceLiveCard from "../components/DeviceLiveCard";
import { describeConnection, describeLocation, useLiveDevice } from "../state/liveDevice";
import { formatDateTime, formatNumber } from "../utils/time";

// Groups real telemetry points by device session into route rows.
export function summarizeRoutes(points = []) {
  const sessions = new Map();
  for (const point of points) {
    const key = point.session_id || "—";
    const item = sessions.get(key) || { id: key, start: point.recorded_at, end: point.recorded_at, count: 0, distance: 0, last: null };
    if (item.last) item.distance += haversineKm(item.last, point);
    item.last = point;
    item.end = point.recorded_at;
    item.count += 1;
    sessions.set(key, item);
  }
  return [...sessions.values()].sort((a, b) => Date.parse(b.end) - Date.parse(a.end));
}

function haversineKm(a, b) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function RoutesPage({ onBack }) {
  const live = useLiveDevice();
  const connection = describeConnection(live);
  const location = describeLocation(live.status);
  const point = live.status?.location;
  const routes = summarizeRoutes(live.route);

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="ROUTES"
        title="نقشه و تاریخچه مسیر"
        subtitle="موقعیت واقعی و نقاط ثبت‌شده نگهبان"
        onBack={onBack}
        action={<StatusBadge tone={connection.tone === "online" ? "success" : "warning"}>{connection.label}</StatusBadge>}
      />

      <section className="panel map-panel">
        {point || live.route.length
          ? <DeviceMap location={point} points={live.route} stale={point?.stale} />
          : <div className="empty-state">{live.loading && !live.status ? "در حال دریافت موقعیت..." : location.detail}</div>}
        <div className="route-summary">
          <Summary label="آخرین موقعیت" value={point ? formatDateTime(point.recorded_at) : "—"} icon={<MapPinned size={17} />} />
          <Summary label="وضعیت موقعیت" value={location.label} icon={<Route size={17} />} />
          <Summary label="آخرین ارتباط" value={live.status?.last_seen ? formatDateTime(live.status.last_seen) : "—"} icon={<CalendarDays size={17} />} />
        </div>
        {point?.stale && <p className="warning-text small-text">{location.detail}</p>}
      </section>

      <ConnectionCheck />
      <DeviceLiveCard />

      <section className="panel">
        <div className="section-title">
          <h3>مسیرهای اخیر</h3>
          <span className="muted small-text">{formatNumber(routes.length)} مورد</span>
        </div>
        <div className="route-list">
          {routes.map((route) => (
            <article className="route-row" key={route.id}>
              <div className="route-icon"><Route size={18} /></div>
              <div className="route-row-main">
                <strong>{formatDateTime(route.start)}</strong>
                <span className="muted">تا {formatDateTime(route.end)}</span>
              </div>
              <div className="route-row-meta">
                <strong>{formatNumber(route.distance, 1)} km</strong>
                <span className="muted">{formatNumber(route.count)} نقطه</span>
              </div>
            </article>
          ))}
        </div>
        {!routes.length && <div className="empty-state">هنوز نقطهٔ مسیری با GPS معتبر ثبت نشده است.</div>}
      </section>
    </section>
  );
}

function Summary({ label, value, icon }) {
  return (
    <div className="route-summary-item">
      <span className="summary-icon">{icon}</span>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
