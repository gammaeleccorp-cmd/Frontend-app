import { useCallback, useEffect, useState } from "react";
import { KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatDateTime } from "../utils/time";

export default function SecurityPage({ listSessions, revokeOthers, onLogout, onBack }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setSessions(await listSessions()); } catch (err) { setError(err?.message || "دریافت نشست‌ها ناموفق بود."); }
  }, [listSessions]);
  useEffect(() => { load(); }, [load]);

  const others = (sessions || []).filter((item) => !item.current);
  const revoke = async () => {
    setBusy(true); setNotice(""); setConfirm(false);
    try {
      const result = await revokeOthers();
      setNotice(`${Number(result?.revoked || 0).toLocaleString("fa-IR")} نشست دیگر خارج شد.`);
      await load();
    } catch (err) { setError(err?.message || "خروج از سایر نشست‌ها ناموفق بود."); }
    finally { setBusy(false); }
  };

  return (
    <section className="page-section">
      <PageHeader eyebrow="SECURITY" title="امنیت" subtitle="ورودهای فعال حساب شما" onBack={onBack} />
      <section className="panel">
        <div className="mini-heading"><KeyRound size={20} /><strong>روش ورود</strong></div>
        <p className="muted">ورود فقط با کد یک‌بارمصرف ارسال‌شده به موبایل حساب انجام می‌شود و رمز عبوری ذخیره نمی‌شود.</p>
      </section>
      <section className="panel">
        <div className="section-title"><h3>نشست‌های فعال</h3>{sessions && <span className="muted small-text">{sessions.length.toLocaleString("fa-IR")} نشست</span>}</div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {!sessions && !error && <p className="muted" role="status">در حال دریافت...</p>}
        <div className="stack-list">
          {(sessions || []).map((item) => (
            <article key={item.id} className="session-row">
              <MonitorSmartphone size={20} />
              <div>
                <strong>ورود {formatDateTime(item.created_at)}</strong>
                <span className="muted small-text">اعتبار تا {formatDateTime(item.expires_at)}</span>
              </div>
              {item.current && <StatusBadge tone="success">همین دستگاه</StatusBadge>}
            </article>
          ))}
        </div>
        <p className="muted small-text">نشست‌ها بر اساس توکن‌های ورود سرور نمایش داده می‌شوند؛ نام دستگاه در سرور ثبت نمی‌شود.</p>
        {notice && <div className="inline-success" role="status">{notice}</div>}
        {others.length > 0 && !confirm && <button type="button" className="secondary-btn full-btn" disabled={busy} onClick={() => setConfirm(true)}>خروج از سایر نشست‌ها</button>}
        {confirm && <div className="confirm-row"><span>همه نشست‌های دیگر بسته شوند؟ (ممکن است تا ۱۵ دقیقه دسترسی فعلی آن‌ها باقی بماند)</span><div><button type="button" className="primary-btn" disabled={busy} onClick={revoke}>تأیید</button><button type="button" className="link-btn" onClick={() => setConfirm(false)}>انصراف</button></div></div>}
      </section>
      <button type="button" className="danger-btn" onClick={onLogout}><LogOut size={18} /> خروج از این دستگاه</button>
    </section>
  );
}
