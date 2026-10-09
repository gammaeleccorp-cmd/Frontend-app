import { useEffect, useState } from "react";
import { BellOff, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { formatDateTime } from "../utils/time";

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export default function NotificationsPage({ feed, loading, error, onReload, onMarkRead, onBack }) {
  const [marking, setMarking] = useState(false);
  const items = feed?.items || [];
  const unread = feed?.unread_count || 0;
  useEffect(() => { onReload(); }, [onReload]);

  const markRead = async () => {
    setMarking(true);
    try { await onMarkRead(); } finally { setMarking(false); }
  };

  return (
    <section className="page-section">
      <PageHeader eyebrow="NOTIFICATIONS" title="اعلان‌ها" subtitle="رویدادهای واقعی دستگاه و نتیجهٔ فرمان‌ها" onBack={onBack}
        action={unread > 0 && <button type="button" className="secondary-btn" disabled={marking} onClick={markRead}>{marking ? "..." : "خواندن همه"}</button>} />
      {error && <div className="form-error" role="alert">{error} <button type="button" className="link-btn" onClick={onReload}>تلاش مجدد</button></div>}
      {loading && !feed && <p className="muted" role="status">در حال دریافت اعلان‌ها...</p>}
      {feed && !items.length && <section className="panel empty-state notifications-empty"><BellOff size={28} /><p>اعلانی وجود ندارد.</p></section>}
      <div className="stack-list">
        {items.map((item) => {
          const Icon = ICONS[item.tone] || CheckCircle2;
          return (
            <article key={item.id} className={`panel notification-item ${item.read ? "is-read" : "is-unread"} tone-${item.tone}`}>
              <Icon size={20} />
              <div>
                <strong>{item.title}</strong>
                <p className="muted compact">{item.body}</p>
                <time className="muted small-text" dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
              </div>
              {!item.read && <span className="unread-dot" aria-label="خوانده‌نشده" />}
            </article>
          );
        })}
      </div>
    </section>
  );
}
