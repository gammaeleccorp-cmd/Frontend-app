import { Activity, RefreshCw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import GammaOrbit from "../components/motion/GammaOrbit";

export default function EcuLivePage({ parameters = [], onBack, onRefresh, refreshing = false }) {
  return (
    <section className="page-section">
      <PageHeader
        eyebrow="LIVE DATA"
        title="داده زنده ECU"
        subtitle="آخرین داده دریافت‌شده از Backend / دستگاه"
        onBack={onBack}
        action={<StatusBadge tone="success">در حال دریافت</StatusBadge>}
      />

      <section className="live-grid">
        {parameters.map((item) => (
          <article className="live-card" key={item.label}>
            <div className="live-card-top">
              <Activity size={17} />
              <span className="muted">{item.label}</span>
            </div>
            <strong>{item.value}</strong>
            <small>{item.unit}</small>
          </article>
        ))}
      </section>

      {!parameters.length && (
        <div className="empty-state">
          داده زنده‌ای از Backend دریافت نشده است.
        </div>
      )}

      <section className="panel refresh-panel">
        <div>
          <h3>نرخ بروزرسانی</h3>
          <p className="muted compact">
            در اتصال واقعی، این بخش از telemetry API تغذیه می‌شود.
          </p>
        </div>
        <button type="button" className="secondary-btn" disabled={refreshing} onClick={onRefresh}>{refreshing ? <GammaOrbit size={18} label="در حال تازه‌سازی ECU" /> : <RefreshCw size={16} />} {refreshing ? "در حال تازه‌سازی..." : "تازه‌سازی"}</button>
      </section>
    </section>
  );
}
