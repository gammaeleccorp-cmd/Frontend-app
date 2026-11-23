import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Check, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { polygonError } from "../utils/flag15.mjs";
import useUpdateBlocker from "../hooks/useUpdateBlocker";

const SIX = 6;
const savedBoundary = (value) => Array.isArray(value?.boundary_points) && value.boundary_points.length === SIX
  ? value.boundary_points.map(point => [...point]) : [];

function MapActions({ open, onPoint }) {
  const map = useMap();
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => map.invalidateSize(), 220);
      return () => clearTimeout(timer);
    }
  }, [open, map]);
  useMapEvents({ click: e => {
    if (!e.originalEvent?.target?.closest?.(".leaflet-control, .geo-floating, .geo-summary")) onPoint([e.latlng.lat, e.latlng.lng]);
  } });
  return null;
}

export default function GeofenceEditor({ fence, deviceCode, lastPoint }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [savedPoints, setSavedPoints] = useState("[]");
  const existing = fence.value;
  const invalid = polygonError(points);

  useEffect(() => {
    if (existing?.boundary_points?.length === SIX && points.length === 0 && savedPoints === "[]") {
      const boundary = savedBoundary(existing);
      setPoints(boundary);
      setSavedPoints(JSON.stringify(boundary));
    }
  }, [existing, points.length, savedPoints]);

  useUpdateBlocker(busy || fence.loading || (JSON.stringify(points) !== savedPoints));

  const save = async () => {
    if (invalid || busy || !existing?.supports_polygon) return;
    setBusy(true);
    setNotice("");
    try {
      if (await fence.save({ boundary_points: points })) {
        setSavedPoints(JSON.stringify(points));
        setNotice("محدوده ذخیره شد.");
        setMenuOpen(false);
      }
    } finally { setBusy(false); }
  };
  const reset = () => {
    setPoints(JSON.parse(savedPoints));
    setNotice("");
    setError("");
    setMenuOpen(false);
  };
  const actionItems = [
    { name: "حذف آخرین نقطه", Icon: Undo2, disabled: !points.length || busy, action: () => setPoints(v => v.slice(0, -1)) },
    { name: "حذف نقاط", Icon: Trash2, disabled: !points.length || busy, action: () => { if (window.confirm("همه نقاط انتخاب‌شده حذف شوند؟")) setPoints([]); } },
    { name: "ریست محدوده", Icon: RotateCcw, disabled: busy || JSON.stringify(points) === savedPoints, action: reset },
    { name: "ذخیره محدوده", Icon: Check, disabled: !!invalid || busy || !existing?.supports_polygon, action: save, primary: true },
  ];

  return <section className="panel geo-editor">
    <button className="secondary-btn" type="button" aria-expanded={open} aria-controls="fence-editor"
      onClick={() => { setOpen(v => !v); setMenuOpen(false); }}>محدوده جغرافیایی · {open ? "بستن" : "باز کردن"}</button>
    <div id="fence-editor" className={`fence-disclosure ${open ? "is-open" : ""}`} inert={open ? undefined : ""}>
      <div>
        <p className="geo-instruction">شش نقطه را به‌ترتیب روی نقشه انتخاب کنید.</p>
        <div className="map-wrap geo-map">
          <MapContainer center={lastPoint || [35.6892, 51.389]} zoom={13} doubleClickZoom={false}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ tileerror: () => setError("بارگذاری نقشه ناموفق بود.") }} />
            <MapActions open={open} onPoint={p => {
              if (!busy) { setPoints(v => v.length < SIX ? [...v, p] : v); setNotice(""); }
              setMenuOpen(false);
            }} />
            {existing?.configured && Number.isFinite(existing.latitude) && Number.isFinite(existing.longitude) && !existing.boundary_points?.length && <Circle center={[existing.latitude, existing.longitude]} radius={existing.radius_m} />}
            {existing?.boundary_points?.length >= 3 && <Polygon positions={existing.boundary_points} pathOptions={{ color: "#8b8e95" }} />}
            {points.length === SIX
              ? <Polygon positions={points} pathOptions={{ color: invalid ? "#ff5252" : "#ff6b1a", fillColor: "#ff6b1a", fillOpacity: 0.18 }} />
              : <Polyline positions={points} pathOptions={{ color: "#ff6b1a" }} />}
            {points.map((p, i) => <CircleMarker key={i} center={p} radius={9}
              pathOptions={{ color: "#fff", weight: 2, fillColor: "#ff6b1a", fillOpacity: 1 }}>
              <Tooltip permanent direction="top">{i + 1}</Tooltip>
            </CircleMarker>)}
          </MapContainer>
          <div className="geo-summary" role="status">{points.length.toLocaleString("fa-IR")} از ۶ نقطه</div>
          <div className="geo-floating" onClick={e => e.stopPropagation()}>
            {menuOpen && <div id="geo-actions" className="geo-speed-actions">
              {actionItems.map(({ name, Icon, disabled, action, primary }) =>
                <button key={name} type="button" className={`geo-action ${primary ? "is-primary" : ""}`}
                  disabled={disabled} aria-label={name} onClick={() => { action(); if (!primary) setNotice(""); }}>
                  <span>{name}</span><Icon size={19} aria-hidden="true" />
                </button>)}
            </div>}
            <button type="button" className="geo-fab" aria-expanded={menuOpen} aria-controls="geo-actions"
              aria-label="ابزارهای GEO" onClick={() => setMenuOpen(v => !v)}>GEO</button>
          </div>
        </div>
        {invalid && points.length === SIX && <p className="form-error" role="alert">{invalid}</p>}
        {!existing?.supports_polygon && <p role="status">ذخیره محدوده چندضلعی به پشتیبانی سرور نیاز دارد.</p>}
        {error && <p role="alert">{error}</p>}
        {fence.error && <p role="alert">{fence.error}</p>}
        {notice && <p role="status">{notice}</p>}
        {existing?.is_active && <button type="button" className="secondary-btn" disabled={fence.loading}
          onClick={() => fence.disable()}>غیرفعال کردن محدوده فعلی</button>}
        {!deviceCode && <p>دستگاهی انتخاب نشده است.</p>}
      </div>
    </div>
  </section>;
}
