import { AlertTriangle, CheckCircle2, Stethoscope } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StateMessage from "../components/StateMessage";

export default function DtcDetailPage({ dtc, onBack }) {
  if (!dtc) return <StateMessage error="کد خطا پیدا نشد." onRetry={onBack} />;

  return (
    <section className="page-section">
      <PageHeader eyebrow="DTC INTERPRETATION" title={`${dtc.code} • ${dtc.title}`} subtitle="تفسیر اولیه برای کمک به بررسی فنی" onBack={onBack} action={<StatusBadge tone="warning">{dtc.severity}</StatusBadge>} />

      <section className="panel interpretation-hero">
        <div className="big-alert-icon"><AlertTriangle size={30} /></div>
        <div><h3>{dtc.title}</h3><p className="muted">{dtc.description}</p></div>
      </section>

      <section className="detail-grid">
        <DetailList title="علائم احتمالی" icon={<Stethoscope />} items={dtc.symptoms} />
        <DetailList title="علت‌های محتمل" icon={<AlertTriangle />} items={dtc.causes} />
      </section>

      <section className="panel recommendation-card">
        <div className="mini-heading"><CheckCircle2 /><strong>پیشنهاد بررسی</strong></div>
        <p>{dtc.recommendation}</p>
        <p className="disclaimer">این بخش تشخیص قطعی تعمیرگاهی نیست و برای راهنمایی اولیه ارائه می‌شود.</p>
      </section>
    </section>
  );
}

function DetailList({ title, icon, items }) {
  return (
    <section className="panel compact-panel">
      <div className="mini-heading">{icon}<strong>{title}</strong></div>
      <ul className="clean-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}
