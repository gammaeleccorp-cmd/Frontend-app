import { useState } from "react";

export default function DeviceOnboardingPage({ onSubmit, loading = false, error = "" }) {
  const [form, setForm] = useState({ deviceCode: "", nationalId: "", vin: "", make: "", model: "", productionYear: "", color: "", licensePlate: "" });
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const valid = /^(NG|LM|RH)-\d{4}$/.test(form.deviceCode) && /^\d{10}$/.test(form.nationalId) && /^[A-HJ-NPR-Z0-9]{17}$/.test(form.vin) && form.model.trim() && form.color.trim() && /^\d{4}$/.test(form.productionYear);
  return (
    <main className="shell center auth-shell"><section className="auth-card">
      <p className="eyebrow">GAMMA VEHICLE SYSTEM</p><h1>دستگاه خود را اضافه کنید</h1>
      <p className="muted">کد دستگاه و اطلاعات خودرو را برای بررسی مالکیت وارد کنید.</p>
      {[["deviceCode", "کد دستگاه", "NG-0001"], ["nationalId", "کد ملی", "کد ملی ۱۰ رقمی"], ["vin", "VIN", "VIN ۱۷ کاراکتری"], ["model", "مدل خودرو", "مدل"], ["color", "رنگ خودرو", "رنگ"], ["productionYear", "سال تولید", "۱۴۰۲"], ["licensePlate", "پلاک خودرو", "پلاک"]].map(([name, label, placeholder]) => <label key={name}>{label}<input value={form[name]} placeholder={placeholder} dir="ltr" inputMode={name === "nationalId" || name === "productionYear" ? "numeric" : "text"} onChange={(event) => update(name, name === "deviceCode" ? event.target.value.toUpperCase() : event.target.value)} disabled={loading} /></label>)}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-btn full-btn" type="button" disabled={!valid || loading} onClick={() => onSubmit(form)}>{loading ? "در حال بررسی..." : "افزودن دستگاه"}</button>
    </section></main>
  );
}
