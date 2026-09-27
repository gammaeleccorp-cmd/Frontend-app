import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import { CalendarDays, MapPinned, Route } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import GammaSyncProgress from "../components/motion/GammaSyncProgress";

export default function RoutesPage({
  routePoints = [],
  routeHistory = [],
  onBack,
  negahbanStatus,
  onSync,
  syncing = false,
}) {
  const safePoints = routePoints.length
    ? routePoints
    : [[35.709, 51.405]];

  const lastPoint = safePoints[safePoints.length - 1];
  const latest = routeHistory[0];

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="ROUTES"
        title="نقشه و تاریخچه مسیر"
        subtitle="موقعیت فعلی و مسیرهای ذخیره‌شده نگهبان"
        onBack={onBack}
        action={<StatusBadge tone={negahbanStatus?.online ? "success" : "warning"}>{negahbanStatus?.online ? "آنلاین" : "آفلاین"}</StatusBadge>}
      />

      <section className="panel map-panel">
        <div className="map-wrap full-map">
          <MapContainer
            center={lastPoint}
            zoom={13}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {safePoints.length > 1 && <Polyline positions={safePoints} />}
            <CircleMarker center={lastPoint} radius={10} />
          </MapContainer>
        </div>

        <div className="route-summary">
          <Summary
            label="آخرین موقعیت"
            value={latest?.date || "—"}
            icon={<MapPinned size={17} />}
          />
          <Summary
            label="مسافت آخرین مسیر"
            value={latest?.distance || "—"}
            icon={<Route size={17} />}
          />
          <Summary
            label="آخرین Sync"
            value={negahbanStatus?.sync?.lastSync || "—"}
            icon={<CalendarDays size={17} />}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h3>مسیرهای اخیر</h3>
          <span className="muted small-text">{routeHistory.length} مورد</span>
        </div>
        <GammaSyncProgress progress={syncing ? 50 : negahbanStatus?.sync?.pendingRecords ? 0 : 100} label="همگام‌سازی نگهبان" />
        <div className="sync-row"><span className="muted">{negahbanStatus?.sync?.status || "نامشخص"} · {negahbanStatus?.sync?.pendingRecords || 0} مورد در انتظار</span><button type="button" className="secondary-btn" disabled={syncing} onClick={onSync}>همگام‌سازی</button></div>

        <div className="route-list">
          {routeHistory.map((route) => (
            <article className="route-row" key={route.id}>
              <div className="route-icon"><Route size={18} /></div>
              <div className="route-row-main">
                <strong>{route.date}</strong>
                <span className="muted">{route.start} تا {route.end}</span>
              </div>
              <div className="route-row-meta">
                <strong>{route.distance}</strong>
                <span className="muted">{route.duration}</span>
              </div>
            </article>
          ))}
        </div>

        {!routeHistory.length && (
          <div className="empty-state">
            هنوز مسیری از Backend دریافت نشده است.
          </div>
        )}
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
