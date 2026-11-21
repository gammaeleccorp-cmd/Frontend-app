import { HISTORY_INTERVALS, pointsWithinInterval } from "../utils/historyInterval.mjs";
import { recentRecordedPoints, neshanUrl } from "../utils/flag15.mjs";
import RecordedPointPopup from "../components/RecordedPointPopup";
import { recordedSpeed } from "../utils/routeMarkers.mjs";
import RouteMarkers from "../components/RouteMarkers";
import { routeMarkers } from "../utils/routeMarkers.mjs";
import GeofenceEditor from "../components/GeofenceEditor";
import { useState } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import { ChevronDown, MapPinned, RefreshCcw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

const EMPTY_INTERVAL = "در داده‌های دریافت‌شده، نقطه‌ای در این بازه پیدا نشد؛ ممکن است تاریخچهٔ دیگری روی سرور موجود باشد.";

export default function RoutesPage({ now = Date.now(), geofence, routePoints = [], routeHistory = [], deviceCode, online, historyError, onSync, syncing = false, onBack }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [interval, setInterval] = useState(24);
  const allHistory = recentRecordedPoints(routeHistory, Infinity);
  const history = pointsWithinInterval(allHistory, interval, now);
  const points = history.slice().reverse().map(point => point.coordinates).filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const markers = routeMarkers(history);
  const lastPoint = markers.at(-1)?.point.coordinates || points.at(-1);
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
            <RouteMarkers history={history} />
          </MapContainer>
          {tilesFailed && <div className="map-error-overlay" role="alert">کاشی‌های نقشه بارگذاری نشدند. نقاط ثبت‌شده از فهرست پایین قابل مشاهده‌اند.<button type="button" className="secondary-btn" onClick={retryMap}>تلاش مجدد</button></div>}
        </> : <div className="empty-state map-empty">{historyError || EMPTY_INTERVAL}</div>}
      </div>
      {historyError && <p className="form-error" role="alert">{historyError}</p>}
      <button type="button" className="secondary-btn route-refresh" disabled={syncing} onClick={onSync}>
        <RefreshCcw size={16} className={syncing ? "spin" : ""} />{syncing ? "در حال به‌روزرسانی..." : "به‌روزرسانی موقعیت‌ها"}
      </button>
    <details className="route-history">
      <summary><h3>نقاط ثبت‌شده</h3><span className="muted small-text">{history.length} مورد</span><ChevronDown className="route-history-chevron" size={20} aria-hidden="true" /></summary>
      <div className="route-interval" dir="rtl">
        <label htmlFor="route-interval">بازهٔ زمانی</label>
        <select id="route-interval" value={interval} onChange={event => setInterval(Number(event.target.value))} aria-describedby="route-interval-coverage">
          {HISTORY_INTERVALS.map(option => <option key={option.hours} value={option.hours}>{option.label}</option>)}
        </select>
        <p className="muted" id="route-interval-coverage">فیلتر روی نقاط دریافت‌شده اعمال می‌شود. ممکن است سرور فقط ۱۰۰ رکورد آخر را برگرداند.</p>
      </div>
      <div className="route-list">
        {history.map((item) => <article className="route-row" key={`${item.id}-${item.recordedAt}-${item.coordinates.join(",")}`}>
          <div className="route-icon"><MapPinned size={18} /></div>
          <div className="route-row-main"><strong><time dateTime={item.recordedAt}>{item.date || formatTelemetryTime(item.recordedAt)}</time></strong><a className="muted" href={neshanUrl(item.coordinates)} target="_blank" rel="noopener noreferrer">مشاهده در نشان</a><details className="route-record-details"><summary>جزئیات نقطه</summary><RecordedPointPopup marker={{ label: 'نقطه ثبت‌شده', points: [item] }} /></details></div>
          <div className="route-row-meta"><span className="muted">{recordedSpeed(item.speed) === null ? "ثبت نشده" : `${recordedSpeed(item.speed)} km/h`}</span></div>
        </article>)}
      </div>
      {!history.length && <div className="empty-state">{EMPTY_INTERVAL}</div>}
    </details>
    </section>
    {geofence && <GeofenceEditor key={deviceCode} fence={geofence} deviceCode={deviceCode} lastPoint={allHistory[0]?.coordinates || routePoints.at(-1)} />}
  </section>;
}
