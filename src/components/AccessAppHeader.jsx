import BrandHeader from "./BrandHeader";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRODUCTS } from "../data/mockData";
import { formatTelemetryTime } from "../utils/telemetry.mjs";

export default function AccessAppHeader({ welcome, product, vehicle, availableProducts = [], onProductChange, online = false, notifications = { unread_count: 0, items: [] }, impactEvents = [], onMarkNotificationsRead }) {
  const rahban = product === PRODUCTS.RAHBAN;
  const canSwitch = availableProducts.length > 1;
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState({});
  const wrap = useRef(null);
  const bell = useRef(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setOpen(false); bell.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const impactItems = impactEvents.filter(event => Number.isFinite(event.impactG) && event.impactG > 3 && event.id != null)
    .map(event => ({
      id: `gamma-impact:${vehicle?.deviceCode}:${event.id}`,
      title: event.impactG > 4 ? "هشدار احتمال ضربه ترافیکی" : "هشدار احتمال رد موانع عمیق (چاله)",
      body: `شدت ضربه: ${event.level}`,
      created_at: event.recordedAt,
      tone: "warning",
      impact: true,
    }))
    .filter(item => {
      if (dismissed[item.id]) return false;
      try { return localStorage.getItem(item.id) !== "1"; } catch { return true; }
    });
  const serverItems = notifications?.items || [];
  const legacyImpacts = serverItems.filter(item => item.title === "هشدار تصادف");
  const serverKey = item => `gamma-notification:${item.id}`;
  const visibleServerItems = serverItems.filter(item => {
    if (legacyImpacts.includes(item) || dismissed[serverKey(item)]) return false;
    try { return localStorage.getItem(serverKey(item)) !== "1"; } catch { return true; }
  });
  const items = [...impactItems, ...visibleServerItems];
  const serverUnread = Math.max(0, (Number(notifications?.unread_count) || 0) - legacyImpacts.filter(item => !item.read).length);
  const unread = Math.max(0, serverUnread - serverItems.filter(item => !item.read && !legacyImpacts.includes(item) && !visibleServerItems.includes(item)).length) + impactItems.length;
  const dismissImpact = (id) => {
    setDismissed(current => ({ ...current, [id]: true }));
    try { localStorage.setItem(id, "1"); } catch { /* In-memory dismissal still applies. */ }
  };

  const toggleNotifications = () => {
    const next = !open;
    setOpen(next);
    if (next && serverUnread) void Promise.resolve(onMarkNotificationsRead?.()).catch(() => {});
  };

  return (
    <header className="app-header">
      <BrandHeader />
      {welcome}
      <div className="app-header-main">
        <div>
          <div className="header-title-row">
            <h1>{rahban ? "راهبان" : "نگهبان"}</h1>
            <span className={`device-dot${online ? "" : " offline"}`} aria-hidden="true" />
          </div>
          <span className="muted">{vehicle?.deviceCode ? `دستگاه ${vehicle.deviceCode}` : "هنوز دستگاهی متصل نیست"}</span>
        </div>
        <div className="notification-wrap" ref={wrap}>
          <button type="button" ref={bell} className="icon-btn notification-btn" aria-label={`اعلان‌ها${unread ? `، ${unread} خوانده‌نشده` : ""}`} aria-expanded={open} onClick={toggleNotifications}>
            <Bell size={20} />
            {unread > 0 && <span className="notification-count">{unread > 9 ? "+9" : unread}</span>}
          </button>
          {open && <section className="notification-panel" aria-label="اعلان‌های داخل اپ">
            <div className="notification-heading"><strong>اعلان‌ها</strong><span className="muted">۳۰ روز اخیر</span></div>
            <div className="notification-list">{items.length ? items.map((item) => <article className={`notification-item tone-${item.tone || "info"}`} key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>{formatTelemetryTime(item.created_at)}</small>
            </article>) : <div className="empty-state compact-empty">اعلان جدیدی وجود ندارد.</div>}</div>
            {items.length > 0 && <button type="button" className="secondary-btn" onClick={() => {
              items.forEach(item => dismissImpact(item.impact ? item.id : serverKey(item)));
              if (serverUnread) void Promise.resolve(onMarkNotificationsRead?.()).catch(() => {});
            }}>باشه</button>}
          </section>}
        </div>
      </div>
      {canSwitch && <div className="product-switch" aria-label="انتخاب محصول">
        <button type="button" className={rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.RAHBAN)}>راهبان</button>
        <button type="button" className={!rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.NEGAHBAN)}>نگهبان</button>
      </div>}
    </header>
  );
}
