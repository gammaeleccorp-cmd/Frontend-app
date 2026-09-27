import {
  Activity,
  Bluetooth,
  Car,
  Navigation,
  Radio,
  RefreshCcw,
  Route,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import GammaStatus from "../components/motion/GammaStatus";
import { PRODUCTS, VIEWS } from "../data/mockData";

export default function HomePage({
  product,
  data,
  onNavigate,
  onDtcOpen,
}) {
  return product === PRODUCTS.LUMINEN ? (
    <LuminenHome
      data={data}
      onNavigate={onNavigate}
      onDtcOpen={onDtcOpen}
    />
  ) : (
    <NegahbanHome data={data} onNavigate={onNavigate} />
  );
}

function LuminenHome({ data, onNavigate, onDtcOpen }) {
  const primaryDtc = data.dtcs?.[0];

  return (
    <>
      <StatusHero
        icon={<Car size={42} />}
        label="وضعیت خودرو"
        title={primaryDtc ? "نیاز به بررسی دارد" : "همه‌چیز عادی است"}
        subtitle="ECU پاسخ می‌دهد • VIN شناسایی شده"
        warning={Boolean(primaryDtc)}
      />

      <section className="connection-grid">
        <ConnectionCard
          icon={<Bluetooth />}
          label="اتصال فعلی"
          title="Bluetooth"
          subtitle={
            data.connection?.bluetooth?.quality
              ? `${data.connection.bluetooth.status} • ${data.connection.bluetooth.quality}`
              : data.connection?.bluetooth?.status || "نامشخص"
          }
          primary
          online={data.connection?.bluetooth?.status === "متصل"}
          onClick={() => onNavigate(VIEWS.CONNECTION)}
        />

        <ConnectionCard
          icon={<Wifi />}
          label="اتصال جایگزین"
          title="Wi‑Fi"
          subtitle={data.connection?.wifi?.status || "نامشخص"}
          onClick={() => onNavigate(VIEWS.CONNECTION)}
        />
      </section>

      <section className="metrics">
        {data.luminenMetrics.map((item) => (
          <MetricCard key={item.label} item={item} />
        ))}
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow no-margin">DIAGNOSTICS</p>
            <h3>تفسیر خطاهای خودرو</h3>
          </div>
          <StatusBadge tone={primaryDtc ? "warning" : "success"}>
            {primaryDtc ? `${data.dtcs.length} خطای ثبت‌شده` : "بدون خطا"}
          </StatusBadge>
        </div>

        {primaryDtc ? (
          <button
            className="dtc-card interactive-card"
            type="button"
            onClick={() => onDtcOpen(primaryDtc)}
          >
            <div className="dtc-code">{primaryDtc.code}</div>
            <div className="dtc-body">
              <div className="dtc-heading">
                <strong>{primaryDtc.title}</strong>
                <span className="severity">{primaryDtc.severity}</span>
              </div>
              <p className="muted">{primaryDtc.description}</p>
            </div>
            <span className="card-chevron">‹</span>
          </button>
        ) : (
          <div className="empty-state compact-empty">
            خطای فعالی از سرور دریافت نشده است.
          </div>
        )}
      </section>

      <section className="two-column">
        <ActionCard
          icon={<RefreshCcw />}
          title="OTA Update"
          text="وضعیت Firmware دستگاه را بررسی کنید."
          action="بررسی بروزرسانی"
          onClick={() => onNavigate(VIEWS.OTA)}
        />
        <ActionCard
          icon={<Radio />}
          title="ECU Live Data"
          text="پارامترهای لحظه‌ای ECU."
          action="مشاهده پارامترها"
          onClick={() => onNavigate(VIEWS.ECU_LIVE)}
        />
      </section>
    </>
  );
}

function NegahbanHome({ data, onNavigate }) {
  const latestRoute = data.routeHistory?.[0];

  return (
    <>
      <StatusHero
        icon={<Navigation size={42} />}
        label="وضعیت ردیاب"
        title="آنلاین و در حال ارسال"
        subtitle="آخرین داده از سرور دریافت شده است"
      />

      <section className="metrics">
        {data.negahbanMetrics.map((item) => (
          <MetricCard key={item.label} item={item} />
        ))}
      </section>

      <section className="panel map-preview-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow no-margin">LOCATION</p>
            <h3>آخرین وضعیت مسیر</h3>
          </div>
          <StatusBadge tone={data.negahbanStatus?.online ? "success" : "warning"}>{data.negahbanStatus?.online ? "آنلاین" : "آفلاین"}</StatusBadge>
        </div>

        <div className="location-summary-grid">
          <div>
            <span className="muted">آخرین موقعیت</span>
            <strong>{latestRoute?.date || "—"}</strong>
          </div>
          <div>
            <span className="muted">مسافت آخرین مسیر</span>
            <strong>{latestRoute?.distance || "—"}</strong>
          </div>
          <div>
            <span className="muted">وضعیت GNSS</span>
            <strong>{data.connection?.gnss?.status || "نامشخص"}</strong>
          </div>
        </div>

        <button
          className="secondary-btn"
          type="button"
          onClick={() => onNavigate(VIEWS.ROUTES)}
        >
          مشاهده نقشه و مسیرها
        </button>
      </section>

      <section className="two-column">
        <ActionCard
          icon={<Activity />}
          title="MPU / IMU"
          text="رویدادهای حرکتی ثبت‌شده توسط نگهبان."
          action="مشاهده رویدادها"
          onClick={() => onNavigate(VIEWS.MPU)}
        />
        <ActionCard
          icon={<Route />}
          title="تاریخچه مسیر"
          text="مسیرها و Sync آفلاین دستگاه."
          action="مشاهده تاریخچه"
          onClick={() => onNavigate(VIEWS.ROUTES)}
        />
      </section>
    </>
  );
}

function StatusHero({
  icon,
  label,
  title,
  subtitle,
  warning = false,
}) {
  return (
    <section className="hero">
      <div className="vehicle-icon">{icon}</div>
      <div>
        <span className="muted">{label}</span>
        <h2>{title}</h2>
        <p className="muted compact">{subtitle}</p>
      </div>
      <ShieldCheck
        className={warning ? "warning-text" : "ok"}
        size={30}
      />
    </section>
  );
}

function ConnectionCard({
  icon,
  label,
  title,
  subtitle,
  primary = false,
  online = false,
  onClick,
}) {
  return (
    <article
      className={`connection-card${primary ? " primary-connection" : ""}`}
    >
      <div className="connection-icon">{icon}</div>
      <div>
        <span className="muted">{label}</span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      <GammaStatus status={online ? "online" : "offline"} label={online ? "آنلاین" : "آفلاین"} />
      {onClick && <button type="button" className="link-btn connection-open-btn" onClick={onClick}>مدیریت اتصال</button>}
    </article>
  );
}

function ActionCard({ icon, title, text, action, onClick }) {
  return (
    <article className="panel compact-panel">
      <div className="mini-heading">
        {icon}
        <strong>{title}</strong>
      </div>
      <p className="muted">{text}</p>
      <button className="secondary-btn" type="button" onClick={onClick}>
        {action}
      </button>
    </article>
  );
}
