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

export default function RoutesPage({ geofence, routePoints = [], routeHistory = [], deviceCode, online, historyError, onSync, syncing = false, onBack }) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [interval, setInterval] = useState({ start: '', end: '' });
  const allHistory = recentRecordedPoints(routeHistory, Infinity);
  const history = allHistory.filter(point => (!interval.start || Date.parse(point.recordedAt) >= Date.parse(interval.start)) && (!interval.end || Date.parse(point.recordedAt) <= Date.parse(interval.end)));
  const points = (allHistory.length ? history.slice().reverse().map(point => point.coordinates) : routePoints).filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  const markers = routeMarkers(history);
  const lastPoint = markers.at(-1)?.point.coordinates || points.at(-1);
  const retryMap = () => { setTilesFailed(false); setMapVersion((version) => version + 1); };

  return <section className="page-section">
    <PageHeader eyebrow="ROUTES" title="نقشه و موقعیت‌ها" subtitle={`داده‌های ثبت‌شدهٔ دستگاه ${deviceCode || "—"}`} onBack={onBack}
      action={<StatusBadge tone={online ? "success" : "warning"}>{online ? "داده تازه" : "داده قدیمی"}</StatusBadge>} />

    <section className="panel route-interval" aria-label="بازه زمانی نقاط">
      <label>از زمان<input type="datetime-local" value={interval.start} onChange={event => setInterval({ ...interval, start: event.target.value })} /></label>
      <label>تا زمان<input type="datetime-local" value={interval.end} onChange={event => setInterval({ ...interval, end: event.target.value })} /></label>
      <button type="button" className="secondary-btn" onClick={() => setInterval({ start: '', end: '' })}>همه نقاط دریافتی</button>
      <p className="muted">فیلتر روی تاریخچه دریافتی اعمال می‌شود؛ تعداد نقاط در دسترس به سرور بستگی دارد.</p>
      {interval.start && interval.end && Date.parse(interval.start) > Date.parse(interval.end) && <p role="alert" className="form-error">زمان پایان باید پس از زمان شروع باشد.</p>}
    </section>
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
        </> : <div className="empty-state map-empty">{historyError || "هنوز موقعیت واقعی از دستگاه دریافت نشده است."}</div>}
      </div>
      {historyError && <p className="form-error" role="alert">{historyError}</p>}
      <button type="button" className="secondary-btn route-refresh" disabled={syncing} onClick={onSync}>
        <RefreshCcw size={16} className={syncing ? "spin" : ""} />{syncing ? "در حال به‌روزرسانی..." : "به‌روزرسانی موقعیت‌ها"}
      </button>
    </section>

    {geofence && <GeofenceEditor key={deviceCode} fence={geofence} deviceCode={deviceCode} lastPoint={allHistory[0]?.coordinates || routePoints.at(-1)} />}

    <details className="panel route-history">
      <summary><h3>نقاط ثبت‌شده</h3><span className="muted small-text">{history.length} مورد</span><ChevronDown className="route-history-chevron" size={20} aria-hidden="true" /></summary>
      <div className="route-list">
        {history.map((item) => <article className="route-row" key={`${item.id}-${item.recordedAt}-${item.coordinates.join(",")}`}>
          <div className="route-icon"><MapPinned size={18} /></div>
          <div className="route-row-main"><strong><time dateTime={item.recordedAt}>{item.date || formatTelemetryTime(item.recordedAt)}</time></strong><a className="muted" href={neshanUrl(item.coordinates)} target="_blank" rel="noopener noreferrer">مشاهده در نشان</a><details className="route-record-details"><summary>جزئیات نقطه</summary><RecordedPointPopup marker={{ label: 'نقطه ثبت‌شده', points: [item] }} /></details></div>
          <div className="route-row-meta"><span className="muted">{recordedSpeed(item.speed) === null ? "ثبت نشده" : `${recordedSpeed(item.speed)} km/h`}</span></div>
        </article>)}
      </div>
      {!history.length && <div className="empty-state">هنوز موقعیتی در تاریخچه ثبت نشده است.</div>}
    </details>
  </section>;
}
