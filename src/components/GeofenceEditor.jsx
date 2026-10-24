import { useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { formatTelemetryTime } from "../utils/telemetry.mjs";
import { validCenter, validFence } from "../utils/geofence.mjs";

function SelectCenter({ onSelect, disabled }) {
  useMapEvents({ click: (event) => { if (!disabled) onSelect([event.latlng.lat, event.latlng.lng]); } });
  return null;
}

export default function GeofenceEditor({ fence, deviceCode, lastPoint }) {
  if (!deviceCode) return <section className="panel">دستگاهی انتخاب نشده است.</section>;
  if (fence.loading && !fence.value) return <section className="panel" role="status">در حال دریافت محدوده...</section>;
  if (!fence.value) return <section className="panel"><p className="form-error" role="alert">{fence.error || "محدوده دریافت نشد."}</p><button type="button" className="secondary-btn" onClick={fence.refresh}>تلاش مجدد</button></section>;
  return <Editor key={deviceCode} fence={fence} lastPoint={lastPoint} />;
}

function Editor({ fence, lastPoint }) {
  const existing = fence.value;
  const [center, setCenter] = useState(() => existing.configured && Number.isFinite(existing.latitude) && Number.isFinite(existing.longitude)
    ? [existing.latitude, existing.longitude] : lastPoint || null);
  const [radius, setRadius] = useState(String(existing.radius_m ?? 500));
  const [notice, setNotice] = useState("");
  const [tilesFailed, setTilesFailed] = useState(false);
  const valid = validFence(center, radius);
  const busy = fence.loading;
  const submit = async (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    setNotice("");
    if (await fence.save({ latitude: center[0], longitude: center[1], radius_m: Number(radius) })) setNotice("محدوده ذخیره شد؛ وضعیت با موقعیت بعدی دستگاه مشخص می‌شود.");
  };
  const disable = async () => {
    setNotice("");
    if (await fence.disable()) setNotice("اعلان محدوده غیرفعال شد.");
  };
  return <section className="panel" dir="rtl">
    <h3>محدوده جغرافیایی</h3>
    <p className="muted">برای انتخاب مرکز روی نقشه بزنید، سپس شعاع را تعیین و ذخیره کنید.</p>
    <div className="map-wrap full-map">
      <MapContainer center={validCenter(center) ? center : [35.6892, 51.389]} zoom={13} scrollWheelZoom={false} style={{ height: 300, width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTilesFailed(true) }} />
        <SelectCenter disabled={busy} onSelect={(point) => { setCenter(point); setNotice(""); }} />
        {valid && <Circle center={center} radius={Number(radius)} pathOptions={{ color: "#ff6b1a" }} />}
        {validCenter(center) && <CircleMarker center={center} radius={5} />}
      </MapContainer>
    </div>
    {tilesFailed && <p className="form-error" role="alert">نقشه کامل بارگذاری نشد؛ مختصات مرکز را می‌توانید در فرم وارد کنید.</p>}
    <form onSubmit={submit}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gap: 12, marginTop: 16 }}>
        <label>عرض جغرافیایی <input aria-label="عرض جغرافیایی" type="number" step="any" min="-90" max="90" required dir="ltr" value={Number.isFinite(center?.[0]) ? center[0] : ""} onChange={(e) => { setCenter([e.target.value === "" ? NaN : Number(e.target.value), center?.[1] ?? NaN]); setNotice(""); }} /></label>
        <label>طول جغرافیایی <input aria-label="طول جغرافیایی" type="number" step="any" min="-180" max="180" required dir="ltr" value={Number.isFinite(center?.[1]) ? center[1] : ""} onChange={(e) => { setCenter([center?.[0] ?? NaN, e.target.value === "" ? NaN : Number(e.target.value)]); setNotice(""); }} /></label>
        <label>شعاع (متر) <input type="number" min="50" max="50000" step="1" required dir="ltr" value={radius} onChange={(e) => { setRadius(e.target.value); setNotice(""); }} /></label>
        <small className="muted">بین ۵۰ تا ۵۰٬۰۰۰ متر</small>
        <button type="submit" className="secondary-btn" disabled={!valid || busy}>{busy ? "در حال انجام..." : "ذخیره و فعال‌سازی"}</button>
        <button type="button" className="secondary-btn" disabled={!existing.is_active || busy} onClick={disable}>غیرفعال‌کردن محدوده</button>
      </fieldset>
    </form>
    {fence.error && <p className="form-error" role="alert">{fence.error}</p>}
    {notice && <p role="status">{notice}</p>}
    <p className="muted">آخرین ارزیابی دستگاه: {formatTelemetryTime(existing.last_recorded_at)}</p>
  </section>;
}
