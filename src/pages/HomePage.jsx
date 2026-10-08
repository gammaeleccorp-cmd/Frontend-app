import {
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
import { coordinates, formatTelemetryTime, isTelemetryFresh } from "../utils/telemetry.mjs";

export default function HomePage({
  product,
  data,
  now,
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
    <NegahbanHome data={data} now={now} onNavigate={onNavigate} />
  );
}

function LuminenHome({ data, onNavigate, onDtcOpen }) {
  const primaryDtc = data.dtcs?.[0];

  return (
    <>
      <StatusHero
        icon={<Car size={42} />}
        label="وضعیت خودرو"
        title={primaryDtc ? "نیاز به بررسی دارد" : data.latestTelemetry ? "آخرین داده ثبت شده" : "داده ECU دریافت نشده"}
        subtitle={`زمان آخرین داده: ${formatTelemetryTime(data.latestTelemetry?.recorded_at)}`}
        warning={Boolean(primaryDtc) || !data.latestTelemetry}
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
          <StatusBadge tone="warning">
            {primaryDtc ? `${data.dtcs.length} خطای ثبت‌شده` : "خطایی گزارش نشده"}
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

function NegahbanHome({ data, now, onNavigate }) {
  const online = isTelemetryFresh(data.latestTelemetry, now);
  const latestTime = formatTelemetryTime(data.latestTelemetry?.received_at || data.latestTelemetry?.recorded_at);
  const locationFresh = isTelemetryFresh({ recorded_at: data.latestTelemetry?.recorded_at }, now) && !!coordinates(data.latestTelemetry);
  const location = data.lastLocation;
  const locationTime = coordinates(data.latestTelemetry)
    ? data.latestTelemetry?.recorded_at || data.latestTelemetry?.received_at
    : data.routeHistory?.[0]?.recordedAt;
  const device = data.vehicle || {};

  return (
    <>
      <StatusHero
        icon={<Navigation size={42} />}
        label="وضعیت ردیاب"
        title={online ? "داده تازه از دستگاه" : "داده تازه دریافت نشده"}
        subtitle={`دستگاه ${device.deviceCode || "—"} · آخرین دریافت: ${latestTime}`}
        warning={!online}
      />

      <section className="metrics negahban-metrics">
        {data.negahbanMetrics.map((item) => (
          <MetricCard key={item.label} item={item} />
        ))}
      </section>
      {!data.negahbanMetrics.length && <div className="empty-state">هنوز دادهٔ اندازه‌گیری از دستگاه دریافت نشده است.</div>}
      {data.telemetryError && <p className="form-error" role="alert">{data.telemetryError}</p>}

      <section className="panel map-preview-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow no-margin">LOCATION</p>
            <h3>آخرین موقعیت ثبت‌شده</h3>
          </div>
          <StatusBadge tone={locationFresh ? "success" : "warning"}>{locationFresh ? "تازه" : "قدیمی یا نامشخص"}</StatusBadge>
        </div>

        <div className="location-summary-grid">
          <div>
            <span className="muted">مختصات</span>
            <strong className="mono">{location ? `${location[0].toFixed(6)}, ${location[1].toFixed(6)}` : "ثبت نشده"}</strong>
          </div>
          <div>
            <span className="muted">زمان موقعیت</span>
            <strong>{formatTelemetryTime(locationTime)}</strong>
          </div>
          <div>
            <span className="muted">وضعیت GNSS</span>
            <strong>{locationFresh ? "موقعیت تازه دریافت شد" : location ? "وضعیت فعلی نامشخص" : "موقعیتی ثبت نشده"}</strong>
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
          icon={<Radio />}
          title="دستگاه نگهبان"
          text={`کد ${device.deviceCode || "—"} · آخرین دریافت: ${formatTelemetryTime(data.latestTelemetry?.received_at || device.lastSeen)}`}
          action="اطلاعات دستگاه"
          onClick={() => onNavigate(VIEWS.VEHICLE)}
        />
        <ActionCard
          icon={<Route />}
          title="نقاط ثبت‌شده"
          text={`${data.routeHistory?.length || 0} موقعیت واقعی در تاریخچه دستگاه`}
          action="مشاهده نقشه"
          onClick={() => onNavigate(VIEWS.ROUTES)}
        />
      </section>
      <p className="device-help muted">برای بررسی وضعیت حساب یا ارتباط API، از <button className="link-btn" type="button" onClick={() => onNavigate(VIEWS.PROFILE)}>پروفایل</button> استفاده کنید.</p>
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
