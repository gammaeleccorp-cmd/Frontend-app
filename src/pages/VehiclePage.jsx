import { Car, Cpu, Palette, CalendarDays, Hash } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { PRODUCTS } from "../data/mockData";
import { describeConnection, describeLocation, useLiveDevice } from "../state/liveDevice";
import { formatDateTime } from "../utils/time";

export default function VehiclePage({ product, details, deviceCode, data, onBack, onEditProfile }) {
  const luminen = product === PRODUCTS.LUMINEN;
  const live = useLiveDevice();
  const connection = describeConnection(live);
  const location = describeLocation(live.status);
  const hasDetails = Boolean(details?.hasDetails);
  const effectiveDeviceCode = deviceCode || data?.vehicle?.deviceCode;

  return (
    <section className="page-section">
      <PageHeader eyebrow="VEHICLE" title="خودرو و دستگاه" subtitle="اطلاعات ثبت‌شده و وضعیت واقعی ارتباط" onBack={onBack} />

      <section className="panel vehicle-overview">
        <div className="vehicle-avatar"><Car size={36} /></div>
        <div>
          <h3>{[details?.make, details?.model].filter(Boolean).join(" ") || "اطلاعات خودرو ثبت نشده"}</h3>
          <p className="muted compact">{details?.productionYear ? `مدل ${details.productionYear}` : "مدل خودرو هنوز تکمیل نشده است"}</p>
        </div>
        <StatusBadge tone={connection.tone === "online" ? "success" : "warning"}>{connection.label}</StatusBadge>
      </section>

      {hasDetails ? (
        <section className="info-grid">
          <InfoCard icon={<Car />} label="مدل خودرو" value={details.model || "—"} />
          <InfoCard icon={<CalendarDays />} label="سال تولید" value={details.productionYear || "—"} ltr />
          <InfoCard icon={<Palette />} label="رنگ" value={details.color || "—"} />
          <InfoCard icon={<Hash />} label="پلاک" value={details.plate || "—"} />
        </section>
      ) : (
        <section className="panel empty-vehicle">
          <p className="muted">ثبت خودرو اختیاری است؛ اطلاعات آن هر زمان از پروفایل قابل تکمیل است.</p>
        </section>
      )}
      <button type="button" className={hasDetails ? "secondary-btn full-btn" : "primary-btn full-btn"} onClick={onEditProfile}>
        {hasDetails ? "ویرایش اطلاعات در پروفایل" : "تکمیل اطلاعات در پروفایل"}
      </button>

      <section className="panel vehicle-device-panel">
        <div className="section-title">
          <h3>دستگاه</h3>
          <StatusBadge tone={connection.tone === "online" ? "success" : "warning"}>{connection.label}</StatusBadge>
        </div>
        <div className="status-list">
          <StatusLine icon={<Cpu size={15} />} label="کد دستگاه" value={effectiveDeviceCode || "—"} ltr />
          <StatusLine label="نوع دستگاه" value={luminen ? "راهبان (OBD)" : "نگهبان (ردیاب)"} />
          <StatusLine label="آخرین ارتباط" value={live.status?.last_seen ? formatDateTime(live.status.last_seen) : "—"} />
          <StatusLine label="موقعیت" value={location.label} />
        </div>
        <p className="muted small-text">{connection.detail}</p>
      </section>
    </section>
  );
}

function InfoCard({ icon, label, value, ltr = false }) {
  return (
    <article className="info-card">
      <div className="info-icon">{icon}</div>
      <span className="muted">{label}</span>
      <strong dir={ltr ? "ltr" : undefined}>{value}</strong>
    </article>
  );
}

function StatusLine({ icon, label, value, ltr = false }) {
  return (
    <div className="status-line">
      <span>{icon} {label}</span>
      <span className="muted" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
