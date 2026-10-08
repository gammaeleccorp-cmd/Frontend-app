import { Car, Cpu, MapPinned, Radio, Satellite } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import VehicleLocation from "../components/VehicleLocation";
import { PRODUCTS } from "../data/mockData";
import { coordinates, formatTelemetryTime, isTelemetryFresh } from "../utils/telemetry.mjs";

export default function VehiclePage({ product, data, now, onBack, onUpdate, onRoutes }) {
  const vehicle = data.vehicle || {};
  const negahban = product === PRODUCTS.NEGAHBAN;
  const online = isTelemetryFresh(data.latestTelemetry, now);
  const lastLocation = data.lastLocation;
  const [form, setForm] = useState({ model: vehicle.model || "", color: vehicle.color || "", production_year: vehicle.production_year || vehicle.year || "", license_plate: vehicle.plate || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await onUpdate(form); }
    catch (err) { setError(err?.message || "ذخیرهٔ اطلاعات خودرو ناموفق بود."); }
    finally { setSaving(false); }
  };

  return <section className="page-section">
    <PageHeader eyebrow="DEVICE" title={negahban ? "دستگاه نگهبان" : "خودرو و دستگاه"} subtitle="اطلاعات ثبت‌شده و وضعیت ارتباط" onBack={onBack} />

    <section className="panel device-overview">
      <div className="device-product-mark"><Radio size={36} /></div>
      <div className="device-overview-main"><span className="eyebrow">{negahban ? "NEGAHBAN TRACKER" : "GAMMA DEVICE"}</span>
        <h3 className="mono">{vehicle.deviceCode || "کد دستگاه ثبت نشده"}</h3>
        <p className="muted compact">{vehicle.deviceStatus ? `وضعیت ثبتی: ${vehicle.deviceStatus}` : "وضعیت ثبتی نامشخص"}</p>
      </div>
      <StatusBadge tone={online ? "success" : "warning"}>{online ? "داده تازه" : "داده تازه ندارد"}</StatusBadge>
    </section>

    <section className="info-grid">
      <InfoCard icon={<Cpu />} label="کد عمومی دستگاه" value={vehicle.deviceCode || "—"} mono />
      <InfoCard icon={<Radio />} label="آخرین دریافت" value={formatTelemetryTime(data.latestTelemetry?.received_at || data.latestTelemetry?.recorded_at)} />
      <InfoCard icon={<Satellite />} label="وضعیت GNSS" value={isTelemetryFresh({ recorded_at: data.latestTelemetry?.recorded_at }, now) && coordinates(data.latestTelemetry) ? "موقعیت تازه دریافت شد" : lastLocation ? "وضعیت فعلی نامشخص" : "موقعیتی ثبت نشده"} />
      <InfoCard icon={<MapPinned />} label="زمان ثبت موقعیت" value={formatTelemetryTime(data.latestTelemetry?.recorded_at)} />
    </section>

    {negahban && <section className="panel">
      <div className="section-title"><h3>موقعیت دستگاه</h3></div>
      <p className="muted mono">{lastLocation ? `${lastLocation[0].toFixed(6)}, ${lastLocation[1].toFixed(6)}` : "موقعیتی ثبت نشده است."}</p>
      <button type="button" className="secondary-btn" onClick={onRoutes}>مشاهده نقشه و مسیرها</button>
    </section>}

    {vehicle.id ? <>
      <section className="panel vehicle-overview"><div className="vehicle-avatar"><Car size={30} /></div><div><h3>{vehicle.name || "خودرو"}</h3><p className="muted compact">{vehicle.model || "—"} · {vehicle.plate || "—"}</p></div></section>
      <section className="panel vehicle-form">
        <div className="section-title"><h3>ویرایش اطلاعات خودرو</h3></div>
        <div className="form-grid">
          <label><span>مدل</span><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} disabled={saving} /></label>
          <label><span>رنگ</span><input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} disabled={saving} /></label>
          <label><span>سال تولید</span><input value={form.production_year} onChange={(event) => setForm({ ...form, production_year: event.target.value })} inputMode="numeric" dir="ltr" disabled={saving} /></label>
          <label><span>پلاک</span><input value={form.license_plate} onChange={(event) => setForm({ ...form, license_plate: event.target.value })} disabled={saving} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="button" className="primary-btn" disabled={saving} onClick={save}>{saving ? "در حال ذخیره..." : "ذخیره اطلاعات خودرو"}</button>
      </section>
      {!negahban && <VehicleLocation vehicleId={vehicle.id} />}
    </> : <section className="panel optional-vehicle"><div className="mini-heading"><Car size={20} /><strong>اطلاعات خودرو</strong></div><p>خودرویی برای این دستگاه ثبت نشده است.</p><p className="muted compact">ثبت خودرو اختیاری است؛ نگهبان بدون آن موقعیت را دریافت و نمایش می‌دهد.</p></section>}
  </section>;
}

function InfoCard({ icon, label, value, mono = false }) {
  return <article className="info-card"><div className="info-icon">{icon}</div><span className="muted">{label}</span><strong className={mono ? "mono" : ""}>{value}</strong></article>;
}
