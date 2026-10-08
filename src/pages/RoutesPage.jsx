import { useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import { MapPinned, RefreshCcw, Route } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

export default function RoutesPage({ routePoints = [], routeHistory = [], deviceCode, online, historyError, onSync, syncing = false, onBack }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const points = routePoints.filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const lastPoint = points.at(-1);
  const latest = routeHistory[0];
  const retryMap = () => { setTilesFailed(false); setMapVersion((version) => version + 1); };

  return <section className="page-section">
    <PageHeader eyebrow="ROUTES" title="نقشه و موقعیت‌ها" subtitle={`داده‌های ثبت‌شدهٔ دستگاه ${deviceCode || "—"}`} onBack={onBack}
      action={<StatusBadge tone={online ? "success" : "warning"}>{online ? "داده تازه" : "داده قدیمی"}</StatusBadge>} />

    <section className="panel map-panel">
      <div className="map-wrap full-map">
        {lastPoint ? <>
          <MapContainer key={`${lastPoint.join(",")}-${mapVersion}`} center={lastPoint} zoom={13} scrollWheelZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }} />
            {points.length > 1 && <Polyline positions={points} color="#ff6b1a" />}
            <CircleMarker center={lastPoint} radius={9} pathOptions={{ color: "#ff6b1a", fillColor: "#ff6b1a", fillOpacity: 0.7 }} />
          </MapContainer>
          {tilesFailed && <div className="map-error-overlay" role="alert">کاشی‌های نقشه بارگذاری نشدند. مختصات در پایین قابل مشاهده‌اند.<button type="button" className="secondary-btn" onClick={retryMap}>تلاش مجدد</button></div>}
        </> : <div className="empty-state map-empty">{historyError || "هنوز موقعیت واقعی از دستگاه دریافت نشده است."}</div>}
      </div>
      <div className="route-summary">
        <Summary icon={<MapPinned size={17} />} label="آخرین مختصات" value={lastPoint ? `${lastPoint[0].toFixed(6)}, ${lastPoint[1].toFixed(6)}` : "—"} mono />
        <Summary icon={<Route size={17} />} label="نقاط معتبر" value={String(points.length)} />
        <Summary icon={<RefreshCcw size={17} />} label="زمان آخرین موقعیت" value={formatTelemetryTime(latest?.recordedAt)} />
      </div>
      {historyError && <p className="form-error" role="alert">{historyError}</p>}
      <button type="button" className="secondary-btn route-refresh" disabled={syncing} onClick={onSync}>
        <RefreshCcw size={16} className={syncing ? "spin" : ""} />{syncing ? "در حال به‌روزرسانی..." : "به‌روزرسانی موقعیت‌ها"}
      </button>
    </section>

    <section className="panel">
      <div className="section-title"><h3>نقاط ثبت‌شده</h3><span className="muted small-text">{routeHistory.length} مورد</span></div>
      <div className="route-list">
        {routeHistory.map((item) => <article className="route-row" key={item.id}>
          <div className="route-icon"><MapPinned size={18} /></div>
          <div className="route-row-main"><strong>{item.date}</strong><span className="muted mono">{item.coordinates?.map((value) => value.toFixed(6)).join(", ")}</span></div>
          <div className="route-row-meta"><span className="muted">{item.speed == null ? "" : `${item.speed} km/h`}</span></div>
        </article>)}
      </div>
      {!routeHistory.length && <div className="empty-state">هنوز موقعیتی در تاریخچه ثبت نشده است.</div>}
    </section>
  </section>;
}

function Summary({ icon, label, value, mono = false }) {
  return <div className="route-summary-item"><span className="summary-icon">{icon}</span><span className="muted">{label}</span><strong className={mono ? "mono" : ""}>{value}</strong></div>;
}
