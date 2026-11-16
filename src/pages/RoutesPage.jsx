import { latestPosition, neshanUrl } from "../utils/flag15.mjs";
import GeofenceEditor from "../components/GeofenceEditor";
import { useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import { RefreshCcw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

export default function RoutesPage({ geofence, routePoints = [], routeHistory = [], deviceCode, online, historyError, onSync, syncing = false, onBack }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const points = routePoints.filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const lastPoint = points.at(-1);
  const latest = latestPosition(routeHistory);
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
      {latest ? <a className="primary-btn" href={neshanUrl(latest.coordinates)} target="_blank" rel="noopener noreferrer">باز کردن آخرین موقعیت در نشان</a> : <p>هنوز موقعیت معتبری ثبت نشده است.</p>}
      <p>{formatTelemetryTime(latest?.recordedAt)}</p>
      {historyError && <p className="form-error" role="alert">{historyError}</p>}
      <button type="button" className="secondary-btn route-refresh" disabled={syncing} onClick={onSync}>
        <RefreshCcw size={16} className={syncing ? "spin" : ""} />{syncing ? "در حال به‌روزرسانی..." : "به‌روزرسانی موقعیت‌ها"}
      </button>
    </section>

    {geofence && <GeofenceEditor key={deviceCode} fence={geofence} deviceCode={deviceCode} lastPoint={lastPoint} />}


  </section>;
}
