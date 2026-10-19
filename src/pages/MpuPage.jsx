import { Activity, AlertTriangle, Move3d } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function MpuPage({ events = [], onBack }) {
  const suddenCount = events.filter((event) =>
    String(event.type).includes("ناگهانی")
  ).length;

  const crashCount = events.filter((event) => event.type === "تصادف").length;

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="MPU / IMU"
        title="رویدادهای حرکتی"
        subtitle="لرزش، ضربه و حرکت‌های غیرعادی ثبت‌شده توسط نگهبان"
        onBack={onBack}
      />

      <section className="three-stat-grid">
        <Stat icon={<Activity />} label="وضعیت فعلی" value="عادی" tone="success" />
        <Stat icon={<Move3d />} label="حرکت ناگهانی" value={String(suddenCount)} />
        <Stat icon={<AlertTriangle />} label="تصادف ثبت‌شده" value={String(crashCount)} tone={crashCount ? "warning" : "success"} />
      </section>

      <section className="panel">
        <div className="section-title">
          <h3>آخرین رویدادها</h3>
          <StatusBadge tone="success">سنسور فعال</StatusBadge>
        </div>

        <div className="event-list">
          {events.map((event) => (
            <article className="event-row" key={event.id}>
              <div className="event-icon"><Activity size={18} /></div>
              <div className="event-main">
                <strong>{event.type}</strong>
                <span className="muted">{event.time}</span>
                {event.speed != null && <span className="muted">سرعت: {event.speed} km/h</span>}
                {event.latitude != null && event.longitude != null && <a className="link-btn" href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`} target="_blank" rel="noreferrer">مشاهده موقعیت</a>}
              </div>
              <StatusBadge
                tone={
                  event.level === "عادی" || event.level === "ثبت نشده"
                    ? "success"
                    : "warning"
                }
              >
                {event.level}
              </StatusBadge>
            </article>
          ))}
        </div>

        {!events.length && (
          <div className="empty-state">
            رویداد حرکتی ثبت نشده است.
          </div>
        )}
      </section>
    </section>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <span className="muted">{label}</span>
      <strong className={tone === "success" ? "success-text" : tone === "warning" ? "warning-text" : ""}>
        {value}
      </strong>
    </article>
  );
}
