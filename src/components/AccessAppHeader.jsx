import { Bell } from "lucide-react";
import { PRODUCTS } from "../data/mockData";
import { describeConnection, useLiveDevice } from "../state/liveDevice";

export default function AccessAppHeader({ product, vehicle, availableProducts, onProductChange, onNotify, unreadCount = 0 }) {
  const rahban = product === PRODUCTS.RAHBAN;
  const canSwitch = availableProducts.length > 1;
  const live = useLiveDevice();
  const connection = describeConnection(live);

  return (
    <header className="app-header">
      <div className="app-header-main">
        <div>
          <p className="eyebrow no-margin">GAMMA VEHICLE PLATFORM</p>
          <div className="header-title-row">
            <h1>{!product ? "گاما" : vehicle?.productType === "LUMINEN" ? "لومینن" : rahban ? "راهبان" : "نگهبان"}</h1>
            {live.deviceCode && <span className={`device-dot is-${connection.tone}`} role="img" aria-label={`وضعیت دستگاه: ${connection.label}`} title={`${connection.label} — ${connection.detail}`} />}
          </div>
          <span className="muted">{vehicle?.deviceCode ? `دستگاه ${vehicle.deviceCode} · ${connection.label}` : "حساب کاربری گاما"}</span>
        </div>
        <button type="button" className="icon-btn notification-btn" aria-label={unreadCount ? `اعلان‌ها، ${unreadCount} خوانده‌نشده` : "اعلان‌ها"} onClick={onNotify}>
          <Bell size={20} />
          {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "۹+" : unreadCount.toLocaleString("fa-IR")}</span>}
        </button>
      </div>
      {canSwitch && <div className="product-switch" aria-label="انتخاب محصول">
        <button type="button" className={rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.RAHBAN)}>راهبان</button>
        <button type="button" className={!rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.NEGAHBAN)}>نگهبان</button>
      </div>}
    </header>
  );
}
