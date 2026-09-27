import { Bell } from "lucide-react";
import { PRODUCTS } from "../data/mockData";

export default function AppHeader({ product, vehicle, onProductChange, onNotify }) {
  const luminen = product === PRODUCTS.LUMINEN;

  return (
    <header className="app-header">
      <div className="app-header-main">
        <div>
          <p className="eyebrow no-margin">GAMMA VEHICLE PLATFORM</p>
          <div className="header-title-row">
            <h1>{luminen ? "لومینن" : "نگهبان"}</h1>
            <span className="device-dot" />
          </div>
          <span className="muted">
            {vehicle?.name || "خودرو"} • دستگاه {vehicle?.deviceSerial || "—"}
          </span>
        </div>

        <button type="button" className="icon-btn notification-btn" aria-label="اعلان‌ها" onClick={onNotify}>
          <Bell size={20} />
          <span className="notification-dot" />
        </button>
      </div>

      <div className="product-switch" aria-label="انتخاب محصول">
        <button
          type="button"
          className={luminen ? "active" : ""}
          onClick={() => onProductChange(PRODUCTS.LUMINEN)}
        >
          لومینن
        </button>
        <button
          type="button"
          className={!luminen ? "active" : ""}
          onClick={() => onProductChange(PRODUCTS.NEGAHBAN)}
        >
          نگهبان
        </button>
      </div>
    </header>
  );
}
