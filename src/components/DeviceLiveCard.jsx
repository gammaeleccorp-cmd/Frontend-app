import { MapPinned, RefreshCcw, Satellite, Signal } from "lucide-react";
import GammaStatus from "./motion/GammaStatus";
import { describeConnection, describeLocation, useLiveDevice } from "../state/liveDevice";
import { formatDateTime, formatNumber } from "../utils/time";

const TONE_TO_STATUS = { online: "online", offline: "offline", unknown: "warning" };

export default function DeviceLiveCard({ title = "وضعیت واقعی دستگاه" }) {
  const live = useLiveDevice();
  const connection = describeConnection(live);
  const location = describeLocation(live.status);
  const telemetry = live.status?.latest_telemetry;
  return (
    <section className="panel live-status-panel" aria-live="polite">
      <div className="section-title">
        <div>
          <p className="eyebrow no-margin">LIVE STATUS</p>
          <h3>{title}</h3>
        </div>
        <GammaStatus status={TONE_TO_STATUS[connection.tone]} label={connection.label} />
      </div>
      <div className="live-status-grid">
        <div><Signal size={17} /><span className="muted">ارتباط با سرور</span><strong>{connection.label}</strong><small>{connection.detail}</small></div>
        <div><MapPinned size={17} /><span className="muted">آخرین موقعیت</span><strong className={location.state === "stale" ? "warning-text" : ""}>{location.label}</strong><small>{location.detail || "—"}</small></div>
        <div><Satellite size={17} /><span className="muted">آخرین داده دستگاه</span><strong>{telemetry ? formatDateTime(telemetry.recorded_at) : "—"}</strong><small>{telemetry ? `سرعت ${formatNumber(telemetry.speed)} km/h · ولتاژ ${formatNumber(telemetry.battery_voltage, 1)} V` : "داده‌ای ثبت نشده است"}</small></div>
      </div>
      <button type="button" className="link-btn live-refresh-btn" onClick={live.refresh} disabled={live.loading}>
        <RefreshCcw size={15} /> {live.loading ? "در حال به‌روزرسانی..." : "به‌روزرسانی وضعیت"}
      </button>
    </section>
  );
}
