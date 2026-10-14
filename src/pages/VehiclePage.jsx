import { Car, Cpu, MapPinned, Radio, Satellite } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import VehicleLocation from "../components/VehicleLocation";
import RelayControl from "../components/RelayControl";
import { vehicleErrorMessage, vehiclePayload } from "../utils/vehicle.mjs";
import { PRODUCTS } from "../data/mockData";
import { coordinates, formatTelemetryTime, isTelemetryFresh } from "../utils/telemetry.mjs";

export default function VehiclePage({ product, data, now, onBack, onUpdate, onRoutes, onRegisterVehicle, onSendRelay, onPollCommand }) {
  const vehicle = data.vehicle || {};
  const negahban = product === PRODUCTS.NEGAHBAN;
  const online = isTelemetryFresh(data.latestTelemetry, now);
  const lastLocation = data.lastLocation;

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

    {vehicle.deviceCode && onSendRelay && <RelayControl key={vehicle.deviceCode} deviceCode={vehicle.deviceCode} onSend={onSendRelay} onPoll={onPollCommand} />}

    {vehicle.id ? <>
      <section className="panel vehicle-overview"><div className="vehicle-avatar"><Car size={30} /></div><div><h3>{vehicle.name || "خودرو"}</h3><p className="muted compact">{vehicle.model || "—"} · {vehicle.plate || "—"}</p></div></section>
      <VehicleForm key={vehicle.id} title="ویرایش اطلاعات خودرو" submitLabel="ذخیره اطلاعات خودرو" initial={{ model: vehicle.model === "—" ? "" : vehicle.model, color: vehicle.color === "—" ? "" : vehicle.color, production_year: vehicle.production_year || "", license_plate: vehicle.plate === "—" ? "" : vehicle.plate }} onSubmit={onUpdate} />
      {!negahban && <VehicleLocation vehicleId={vehicle.id} />}
    </> : <OptionalVehicle key={vehicle.deviceCode} canRegister={Boolean(vehicle.deviceCode && onRegisterVehicle)} onRegister={onRegisterVehicle} />}
  </section>;
}

function InfoCard({ icon, label, value, mono = false }) {
  return <article className="info-card"><div className="info-icon">{icon}</div><span className="muted">{label}</span><strong className={mono ? "mono" : ""}>{value}</strong></article>;
}

const EMPTY_VEHICLE = { model: "", color: "", production_year: "", license_plate: "" };

/** Shared create/edit form: same fields as before, no VIN. */
function VehicleForm({ title, submitLabel, initial = EMPTY_VEHICLE, onSubmit, onCancel, requireOne = false }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_VEHICLE, ...initial, production_year: String(initial.production_year ?? "") }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const change = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setFieldErrors({ ...fieldErrors, [key]: "", form: "" }); setError(""); };
  const save = async (event) => {
    event.preventDefault();
    const { errors } = vehiclePayload(form, { requireOne });
    if (Object.keys(errors).length) { setFieldErrors(errors); setError(errors.form || "خطاهای مشخص‌شده را برطرف کنید."); return; }
    setSaving(true); setError(""); setFieldErrors({});
    try { await onSubmit(form); }
    catch (err) { setError(vehicleErrorMessage(err)); setFieldErrors(err?.fieldErrors || {}); }
    finally { setSaving(false); }
  };
  const field = (key, label, extra = {}) => <label htmlFor={`vehicle-${key}`}><span>{label}</span>
    <input id={`vehicle-${key}`} value={form[key]} onChange={change(key)} disabled={saving} aria-invalid={Boolean(fieldErrors[key])} {...extra} />
    {fieldErrors[key] && <small className="field-error">{fieldErrors[key]}</small>}
  </label>;
  return <form className="panel vehicle-form" onSubmit={save} noValidate>
    <div className="section-title"><h3>{title}</h3></div>
    <div className="form-grid">
      {field("model", "مدل", { autoComplete: "off" })}
      {field("color", "رنگ", { autoComplete: "off" })}
      {field("production_year", "سال تولید (شمسی)", { inputMode: "numeric", dir: "ltr", placeholder: "1402", maxLength: 4 })}
      {field("license_plate", "پلاک", { autoComplete: "off", maxLength: 20 })}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="vehicle-form-actions">
      <button type="submit" className="primary-btn" disabled={saving}>{saving ? "در حال ذخیره..." : submitLabel}</button>
      {onCancel && <button type="button" className="ghost-btn" disabled={saving} onClick={onCancel}>انصراف</button>}
    </div>
  </form>;
}

function OptionalVehicle({ canRegister, onRegister }) {
  const [open, setOpen] = useState(false);
  if (open) return <VehicleForm title="ثبت اطلاعات خودرو — اختیاری" submitLabel="ثبت اطلاعات خودرو" requireOne onSubmit={onRegister} onCancel={() => setOpen(false)} />;
  return <section className="panel optional-vehicle">
    <div className="mini-heading"><Car size={20} /><strong>اطلاعات خودرو</strong></div>
    <p>خودرویی برای این دستگاه ثبت نشده است.</p>
    <p className="muted compact">ثبت خودرو اختیاری است؛ نگهبان بدون آن موقعیت را دریافت و نمایش می‌دهد.</p>
    {canRegister && <button type="button" className="secondary-btn optional-vehicle-btn" onClick={() => setOpen(true)}>ثبت اطلاعات خودرو — اختیاری</button>}
  </section>;
}
