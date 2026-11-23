import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Check, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { polygonError } from "../utils/flag15.mjs";
import useUpdateBlocker from "../hooks/useUpdateBlocker";

const REQUIRED_POINTS = 6;
const DEFAULT_CENTER = [35.6892, 51.389];

function RecenterMap({ center, editing }) {
  const map = useMap();
  useEffect(() => {
    if (!editing) map.setView(center, map.getZoom(), { animate: false });
  }, [map, center[0], center[1], editing]);
  return null;
}

function GeofenceLayers({ fence, editing, busy, points, onPoint, lastPoint }) {
  const existing = fence?.value;
  useMapEvents({
    click(event) {
      if (!editing || busy) return;
      const element = event.originalEvent?.target;
      if (element?.closest?.(".leaflet-control, .route-map-marker, .route-recorded-point")) return;
      onPoint([event.latlng.lat, event.latlng.lng]);
    },
  });
  const oldBoundary = existing?.boundary_points;
  const showExisting = Array.isArray(oldBoundary) && oldBoundary.length >= 3 && (!editing || points.length === 0);
  const hasCircle = existing?.configured && Number.isFinite(existing.latitude) && Number.isFinite(existing.longitude)
    && Number.isFinite(existing.radius_m) && !oldBoundary?.length;
  const polygonIssue = polygonError(points, REQUIRED_POINTS);
  return <>
    <RecenterMap center={lastPoint} editing={editing} />
    {hasCircle && <Circle center={[existing.latitude, existing.longitude]} radius={existing.radius_m} pathOptions={{ color: "#8b8e95" }} />}
    {showExisting && <Polygon positions={oldBoundary} pathOptions={{ color: "#8b8e95", interactive: false }} />}
    {editing && (points.length === REQUIRED_POINTS
      ? <Polygon positions={points} pathOptions={{ color: polygonIssue ? "#ff5252" : "#ff6b1a", fillColor: "#ff6b1a", fillOpacity: 0.18, interactive: false }} />
      : <Polyline positions={points} pathOptions={{ color: "#ff6b1a", interactive: false }} />)}
    {editing && points.map((point, index) => <CircleMarker key={index} center={point} radius={8}
      pathOptions={{ color: "#fff", weight: 2, fillColor: "#ff6b1a", fillOpacity: 1, interactive: false }}>
      <Tooltip permanent direction="top">{index + 1}</Tooltip>
    </CircleMarker>)}
  </>;
}

export default function GeofenceEditor({ fence, deviceCode, lastPoint, mapVersion = 0, tilesFailed = false, onTileError, onTileLoad, onRetryMap, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [points, setPoints] = useState([]);
  const [savedPoints, setSavedPoints] = useState("[]");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const existing = fence?.value;
  const center = Array.isArray(lastPoint) && lastPoint.length === 2 && lastPoint.every(Number.isFinite) ? lastPoint : DEFAULT_CENTER;
  const invalid = polygonError(points, REQUIRED_POINTS);
  const explicitlyUnsupported = existing?.supports_polygon === false;
  const canSave = !!deviceCode && !busy && !fence?.loading && !invalid && !explicitlyUnsupported;

  useEffect(() => {
    if (Array.isArray(existing?.boundary_points) && existing.boundary_points.length === REQUIRED_POINTS
        && !points.length && savedPoints === "[]") {
      const saved = existing.boundary_points.map(point => [...point]);
      setPoints(saved);
      setSavedPoints(JSON.stringify(saved));
    }
  }, [existing, points.length, savedPoints]);

  useUpdateBlocker(busy || !!fence?.loading || JSON.stringify(points) !== savedPoints);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setNotice("");
    try {
      const ok = await fence.save({ boundary_points: points });
      if (ok) {
        setSavedPoints(JSON.stringify(points));
        setNotice("محدوده شش‌نقطه‌ای ذخیره شد.");
        setMenuOpen(false);
      }
    } finally { setBusy(false); }
  };
  const reset = () => {
    setPoints(JSON.parse(savedPoints));
    setNotice("");
  };
  const actions = [
    { name: "حذف آخرین نقطه", Icon: Undo2, disabled: !points.length || busy, action: () => setPoints(value => value.slice(0, -1)) },
    { name: "حذف نقاط", Icon: Trash2, disabled: !points.length || busy, action: () => {
      if (window.confirm("همه نقاط انتخاب‌شده حذف شوند؟")) setPoints([]);
    } },
    { name: "ریست محدوده", Icon: RotateCcw, disabled: busy || JSON.stringify(points) === savedPoints, action: reset },
    { name: "ذخیره محدوده", Icon: Check, disabled: !canSave, action: save, primary: true },
  ];

  return <>
    <div className="map-wrap full-map geo-map">
      <MapContainer key={mapVersion} center={center} zoom={13} scrollWheelZoom={false} doubleClickZoom={false}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }} />
        {children}
        {fence && <GeofenceLayers fence={fence} editing={menuOpen} busy={busy} points={points}
          lastPoint={center} onPoint={point => { setPoints(value => value.length < REQUIRED_POINTS ? [...value, point] : value); setNotice(""); }} />}
      </MapContainer>
      {fence && <>
        {menuOpen && <div className="geo-summary" role="status">{points.length.toLocaleString("fa-IR")} از ۶ نقطه</div>}
        <div className="geo-floating" onClick={event => event.stopPropagation()}>
          {menuOpen && <div className="geo-speed-actions" id="geo-actions">
            {actions.map(({ name, Icon, disabled, action, primary }) =>
              <button key={name} type="button" className={`geo-action ${primary ? "is-primary" : ""}`}
                disabled={disabled} aria-label={name} title={name} onClick={action}>
                <Icon size={19} aria-hidden="true" />
              </button>)}
          </div>}
          <button type="button" className="geo-fab" aria-expanded={menuOpen} aria-controls="geo-actions"
            aria-label="ابزارهای GEO" onClick={() => setMenuOpen(open => !open)}>GEO</button>
        </div>
      </>}
      {tilesFailed && <div className="map-error-overlay" role="alert">کاشی‌های نقشه بارگذاری نشدند. نقاط ثبت‌شده از فهرست پایین قابل مشاهده‌اند.
        <button type="button" className="secondary-btn" onClick={onRetryMap}>تلاش مجدد</button>
      </div>}
    </div>
    {fence && <>
      {menuOpen && <p className="geo-instruction">شش نقطه را به‌ترتیب روی همین نقشهٔ موقعیت انتخاب کنید.</p>}
      {menuOpen && points.length === REQUIRED_POINTS && invalid && <p className="form-error" role="alert">{invalid}</p>}
      {menuOpen && explicitlyUnsupported && <p role="status" className="form-error">سرور ذخیرهٔ محدودهٔ چندضلعی را پشتیبانی نمی‌کند.</p>}
      {fence.error && <p role="alert" className="form-error">{fence.error}</p>}
      {notice && <p role="status" className="inline-success">{notice}</p>}
      {existing?.is_active && <button type="button" className="secondary-btn" disabled={busy || fence.loading}
        onClick={() => fence.disable()}>غیرفعال کردن محدوده فعلی</button>}
    </>}
  </>;
}
