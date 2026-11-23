import { recentRecordedPoints, neshanUrl, neshanRouteUrl } from "../utils/flag15.mjs";
import { validCenter } from "../utils/geofence.mjs";
import RecordedPointPopup from "../components/RecordedPointPopup";
import { recordedSpeed } from "../utils/routeMarkers.mjs";
import RouteMarkers from "../components/RouteMarkers";
import { routeMarkers } from "../utils/routeMarkers.mjs";
import GeofenceEditor from "../components/GeofenceEditor";
import { useState } from "react";
import { Polyline } from "react-leaflet";
import { ChevronDown, MapPinned, RefreshCcw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

const EMPTY_HISTORY = "هنوز نقطه‌ای برای این دستگاه دریافت نشده است.";

export default function RoutesPage({ geofence, routePoints = [], routeHistory = [], deviceCode, online, historyError, onSync, syncing = false, onBack }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [navigationError, setNavigationError] = useState("");
  const [locating, setLocating] = useState(false);
  const history = recentRecordedPoints(routeHistory, Infinity);
  const points = history.slice().reverse().map(point => point.coordinates).filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const markers = routeMarkers(history);
  const lastPoint = markers.at(-1)?.point.coordinates || points.at(-1);
  const retryMap = () => { setTilesFailed(false); setMapVersion((version) => version + 1); };
  const navigateToVehicle = () => {
    if (!lastPoint || locating) return;
    setNavigationError("");
    if (!navigator.geolocation) { setNavigationError("دسترسی به موقعیت شما در این مرورگر ممکن نیست."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const origin = [coords.latitude, coords.longitude];
        if (!validCenter(origin)) { setNavigationError("موقعیت دریافتی معتبر نیست."); return; }
        window.location.assign(neshanRouteUrl(origin, lastPoint));
      },
      () => { setLocating(false); setNavigationError("دسترسی به موقعیت شما انجام نشد. مجوز GPS را بررسی کنید."); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  };

  return <section className="page-section">
    <PageHeader eyebrow="ROUTES" title="نقشه و موقعیت‌ها" subtitle={`داده‌های ثبت‌شدهٔ دستگاه ${deviceCode || "—"}`} onBack={onBack}
      action={<StatusBadge tone={online ? "success" : "warning"}>{online ? "داده تازه" : "داده قدیمی"}</StatusBadge>} />

    <section className="panel map-panel">
      {lastPoint || geofence ? <GeofenceEditor key={deviceCode} fence={geofence} deviceCode={deviceCode}
        lastPoint={lastPoint || routePoints.at(-1)} mapVersion={mapVersion} tilesFailed={tilesFailed}
        onTileError={() => setTilesFailed(true)} onTileLoad={() => setTilesFailed(false)} onRetryMap={retryMap}>
        {points.length > 1 && <Polyline positions={points} color="#ff6b1a" />}
        <RouteMarkers history={history} />
      </GeofenceEditor> : <div className="map-wrap full-map"><div className="empty-state map-empty">{historyError || EMPTY_HISTORY}</div></div>}
      {historyError && <p className="form-error" role="alert">{historyError}</p>}
      <button type="button" className="secondary-btn route-refresh" disabled={syncing} onClick={onSync}>
        <RefreshCcw size={16} className={syncing ? "spin" : ""} />{syncing ? "در حال به‌روزرسانی..." : "به‌روزرسانی موقعیت‌ها"}
      </button>
      {lastPoint && <button type="button" className="secondary-btn route-refresh" disabled={locating} onClick={navigateToVehicle}>
        <MapPinned size={16} aria-hidden="true" />{locating ? "در حال دریافت موقعیت شما..." : "مسیریابی با نشان"}
      </button>}
      {navigationError && <p role="alert" className="form-error">{navigationError}</p>}
    <details className="route-history">
      <summary><h3>نقاط ثبت‌شده</h3><span className="muted small-text">{history.length} مورد</span><ChevronDown className="route-history-chevron" size={20} aria-hidden="true" /></summary>
      <div className="route-list">
        {history.map((item) => <article className="route-row" key={`${item.id}-${item.recordedAt}-${item.coordinates.join(",")}`}>
          <div className="route-icon"><MapPinned size={18} /></div>
          <div className="route-row-main"><strong><time dateTime={item.recordedAt}>{item.date || formatTelemetryTime(item.recordedAt)}</time></strong><a className="muted" href={neshanUrl(item.coordinates)} target="_blank" rel="noopener noreferrer">مشاهده در نشان</a><details className="route-record-details"><summary>جزئیات نقطه</summary><RecordedPointPopup marker={{ label: 'نقطه ثبت‌شده', points: [item] }} /></details></div>
          <div className="route-row-meta"><span className="muted">{recordedSpeed(item.speed) === null ? "ثبت نشده" : `${recordedSpeed(item.speed)} km/h`}</span></div>
        </article>)}
      </div>
      {!history.length && <div className="empty-state">{EMPTY_HISTORY}</div>}
    </details>
    </section>
  </section>;
}
