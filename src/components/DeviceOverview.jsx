import { LocateFixed } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatTelemetryTime, isTelemetryFresh } from "../utils/telemetry.mjs";

export default function DeviceOverview({ deviceCode, telemetry, now, onDetails }) {
  const online = isTelemetryFresh(telemetry, now);
  const receivedAt = telemetry?.received_at || telemetry?.recorded_at;
  const timestamp = formatTelemetryTime(receivedAt);

  return <section className="panel device-overview tracker-overview" aria-label="وضعیت دستگاه" dir="rtl">
    <div className="device-overview-main">
      <div className="device-heading"><div className="device-product-mark" aria-hidden="true"><LocateFixed size={20} /></div>{onDetails && <h2>دستگاه نگهبان</h2>}</div>
      {deviceCode ? <span className="device-code-badge mono" dir="ltr" aria-label="کد عمومی دستگاه">{deviceCode}</span> : <p className="compact">کد دستگاه ثبت نشده</p>}
      <div className="device-freshness" role="status"><StatusBadge tone={online ? "success" : "default"}>{online ? "Online" : "Offline"}</StatusBadge></div>
      <p className="device-received">آخرین دریافت: {timestamp === "—" ? "ثبت نشده" : <time dateTime={receivedAt}>{timestamp}</time>}</p>
    </div>
    {onDetails && <button type="button" className="secondary-btn" onClick={onDetails}>اطلاعات دستگاه</button>}
  </section>;
}
