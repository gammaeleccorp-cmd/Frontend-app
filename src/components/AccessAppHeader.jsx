import { PRODUCTS } from "../data/mockData";

export default function AccessAppHeader({ product, vehicle, availableProducts = [], onProductChange, online = false }) {
  const rahban = product === PRODUCTS.RAHBAN;
  const canSwitch = availableProducts.length > 1;

  return (
    <header className="app-header">
      <div className="app-header-main">
        <div>
          <p className="eyebrow no-margin">GAMMA VEHICLE PLATFORM</p>
          <div className="header-title-row">
            <h1>{rahban ? "راهبان" : "نگهبان"}</h1>
            <span className={`device-dot${online ? "" : " offline"}`} aria-hidden="true" />
          </div>
          <span className="muted">{vehicle?.deviceCode ? `دستگاه ${vehicle.deviceCode}` : "هنوز دستگاهی متصل نیست"}</span>
        </div>
      </div>
      {canSwitch && <div className="product-switch" aria-label="انتخاب محصول">
        <button type="button" className={rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.RAHBAN)}>راهبان</button>
        <button type="button" className={!rahban ? "active" : ""} onClick={() => onProductChange(PRODUCTS.NEGAHBAN)}>نگهبان</button>
      </div>}
    </header>
  );
}
