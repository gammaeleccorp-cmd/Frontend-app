import { Activity, AlertTriangle, Move3d } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function MpuPage({ events = [], onBack }) {
  const suddenCount = events.filter((event) =>
    String(event.type).includes("ناگهانی")
  ).length;

  const severeCount = events.filter((event) =>
    ["شدید", "بحرانی"].includes(event.level)
  ).length;

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
        <Stat icon={<AlertTriangle />} label="ضربه شدید" value={String(severeCount)} tone="success" />
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
      <strong className={tone === "success" ? "success-text" : ""}>
        {value}
      </strong>
    </article>
  );
}
