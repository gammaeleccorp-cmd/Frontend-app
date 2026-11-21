import { formatTelemetryTime } from '../utils/telemetry.mjs';
import { recordedSpeed } from '../utils/routeMarkers.mjs';

export default function RecordedPointPopup({ marker }) {
  return (
    <div className="route-point-popup" dir="rtl">
      <strong>{marker.label}</strong>
      {marker.points.map((point, index) => <div className="route-popup-record" key={`${point.recordedAt}-${index}`}>
        {marker.points.length > 1 && <span>{index === 0 ? 'شروع مسیر' : 'پایان مسیر'}</span>}
        <time dateTime={point.recordedAt}>{formatTelemetryTime(point.recordedAt)}</time>
        <span>سرعت: {recordedSpeed(point.speed) === null ? 'ثبت نشده' : <bdi dir="ltr">{recordedSpeed(point.speed)} km/h</bdi>}</span>
        <span>عرض جغرافیایی: <bdi dir="ltr">{point.coordinates?.[0] ?? 'ثبت نشده'}</bdi></span>
        <span>طول جغرافیایی: <bdi dir="ltr">{point.coordinates?.[1] ?? 'ثبت نشده'}</bdi></span>
      </div>)}
      {marker.includesStart && <small>نقطه شروع و پایان در یک موقعیت هستند.</small>}
    </div>
  );
}
