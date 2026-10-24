import { MapPinned } from "lucide-react";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

export default function GeofenceCard({ geofence, loading = false, error = "", onOpen }) {
  const active = geofence?.configured && geofence?.is_active;
  const labels = { INSIDE: "داخل محدوده", OUTSIDE: "خارج محدوده", UNKNOWN: "نامشخص" };
  const status = error ? "وضعیت نامشخص" : loading ? "در حال بررسی..."
    : active ? labels[geofence.position] || "نامشخص" : geofence ? "غیرفعال" : "نامشخص";
  return <article className="metric-card geofence-card">
    <div className="metric-icon"><MapPinned size={21} /></div>
    <span className="muted">محدوده جغرافیایی</span>
    <strong>{status}</strong>
    <small>{error ? "دریافت وضعیت ناموفق بود" : active ? `شعاع ${geofence.radius_m} متر` : geofence?.configured ? "محدوده غیرفعال است" : "محدوده تعریف نشده"}</small>
    {active && <small>آخرین ارزیابی: {formatTelemetryTime(geofence.last_recorded_at)}</small>}
    <button type="button" className="link-btn" onClick={onOpen}>تنظیم محدوده</button>
  </article>;
}
