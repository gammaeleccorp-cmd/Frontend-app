import { Bell, CirclePlus, DatabaseZap, Headset, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { asciiDigits } from "../utils/deviceCode";
import { fromGregorianIso, parseJalaliBirthDate } from "../utils/jalaliDate";

const pad = (value) => String(value).padStart(2, "0");

export function normalizePhone(value) {
  let phone = asciiDigits(value).replace(/[\s\-()]/g, "");
  if (phone.startsWith("+98")) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith("0098")) phone = `0${phone.slice(4)}`;
  return phone;
}

export function isoToJalaliText(value) {
  const parts = fromGregorianIso(String(value || "").slice(0, 10));
  return parts ? `${parts.year}/${pad(parts.month)}/${pad(parts.day)}` : "";
}

export function buildProfileChanges(form, hadVehicle) {
  const vehicle = {
    model: form.model.trim(),
    production_year: asciiDigits(form.productionYear).trim(),
    color: form.color.trim(),
    license_plate: form.plate.trim(),
  };
  const changes = {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    birth_date: form.birthDate ? parseJalaliBirthDate(form.birthDate) : "",
    emergency_phone: normalizePhone(form.emergencyPhone),
  };
  if (hadVehicle || Object.values(vehicle).some(Boolean)) changes.vehicle = vehicle;
  return changes;
}

export function validateProfileForm(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.first_name = "نام را وارد کنید.";
  if (!form.lastName.trim()) errors.last_name = "نام خانوادگی را وارد کنید.";
  if (form.birthDate && !parseJalaliBirthDate(form.birthDate)) errors.birth_date = "تاریخ تولد شمسی را با قالب yyyy/mm/dd وارد کنید.";
  const phone = normalizePhone(form.emergencyPhone);
  if (phone && !/^0\d{10}$/.test(phone)) errors.emergency_phone = "شماره تلفن اضطراری باید ۱۱ رقم و با ۰ شروع شود.";
  const year = asciiDigits(form.productionYear).trim();
  if (year && !(/^\d{4}$/.test(year) && ((+year >= 1300 && +year <= 1500) || (+year >= 1950 && +year <= 2100)))) errors.production_year = "سال تولید چهاررقمی معتبر وارد کنید.";
  return errors;
}

function initialForm(user, vehicle) {
  return {
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    birthDate: isoToJalaliText(user?.birthDate),
    emergencyPhone: user?.emergencyPhone || "",
    model: vehicle?.model || "",
    productionYear: vehicle?.productionYear || "",
    color: vehicle?.color || "",
    plate: vehicle?.plate || "",
  };
}

function serverErrors(payload) {
  if (!payload || typeof payload !== "object") return {};
  const flat = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "vehicle" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, message] of Object.entries(value)) flat[inner] = [].concat(message)[0];
    } else if (key !== "detail") {
      flat[key] = [].concat(value)[0];
    }
  }
  return flat;
}

export default function ProfilePage({ user, vehicle, unreadCount = 0, onTestBackend, onBack, onLogout, onUpdate, onNavigate }) {
  const [checking, setChecking] = useState(false);
  const [backend, setBackend] = useState(null);
  const [form, setForm] = useState(() => initialForm(user, vehicle));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState(null);

  const set = (key, value) => {
    let next = value;
    if (key === "emergencyPhone") next = asciiDigits(value).replace(/[^0-9+]/g, "").slice(0, 14);
    if (key === "productionYear") next = asciiDigits(value).replace(/\D/g, "").slice(0, 4);
    if (key === "birthDate") next = asciiDigits(value).replace(/[^0-9/]/g, "").slice(0, 10);
    setForm((current) => ({ ...current, [key]: next }));
    setErrors((current) => ({ ...current, [key === "emergencyPhone" ? "emergency_phone" : key === "productionYear" ? "production_year" : key === "birthDate" ? "birth_date" : key === "firstName" ? "first_name" : key === "lastName" ? "last_name" : key]: "" }));
    setSaveState(null);
  };

  const save = async () => {
    const found = validateProfileForm(form);
    setErrors(found);
    if (Object.keys(found).length) { setSaveState({ tone: "error", text: "موارد مشخص‌شده را اصلاح کنید." }); return; }
    setSaving(true); setSaveState(null);
    try {
      await onUpdate(buildProfileChanges(form, Boolean(vehicle?.hasDetails)));
      setSaveState({ tone: "success", text: "اطلاعات در سرور ذخیره شد." });
    } catch (error) {
      setErrors(serverErrors(error?.payload));
      setSaveState({ tone: "error", text: error?.message || "ذخیره اطلاعات ناموفق بود." });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setChecking(true); setBackend(null);
    try { setBackend(await onTestBackend()); } catch { setBackend({ reachable: false, status: 0 }); } finally { setChecking(false); }
  };

  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "کاربر گاما";
  const field = (key, errorKey, label, props = {}) => (
    <label className="form-field">
      <span>{label}</span>
      <input value={form[key]} onChange={(event) => set(key, event.target.value)} disabled={saving} aria-invalid={Boolean(errors[errorKey])} {...props} />
      {errors[errorKey] && <small className="field-error" role="alert">{errors[errorKey]}</small>}
    </label>
  );

  return (
    <section className="page-section profile-page">
      <PageHeader eyebrow="ACCOUNT" title="پروفایل" subtitle="تنظیمات حساب و اپلیکیشن" onBack={onBack} />

      <section className="panel profile-card">
        <div className="profile-avatar"><UserRound size={28} /></div>
        <div>
          <h3>{fullName}</h3>
          <p className="muted compact" dir="ltr">{user?.mobile || "—"}</p>
        </div>
      </section>

      <section className="settings-list">
        <SettingRow icon={<Bell />} title="اعلان‌ها" subtitle={unreadCount ? `${unreadCount.toLocaleString("fa-IR")} اعلان خوانده‌نشده` : "رویدادهای دستگاه و فرمان‌ها"} onClick={() => onNavigate("/notifications")} />
        <SettingRow icon={<Shield />} title="امنیت" subtitle="نشست‌های فعال و خروج" onClick={() => onNavigate("/security")} />
        <SettingRow icon={<Settings />} title="تنظیمات برنامه" subtitle="به‌روزرسانی خودکار، انیمیشن و اندازه متن" onClick={() => onNavigate("/settings")} />
        <SettingRow icon={<Headset />} title="پشتیبانی" subtitle="راه‌های ارتباط با پشتیبانی گاما" onClick={() => onNavigate("/support")} />
        <SettingRow icon={<CirclePlus />} title="افزودن دستگاه" subtitle="اتصال دستگاه دیگر با کد عمومی" onClick={() => onNavigate("/add-device")} />
      </section>

      <form className="panel profile-form" onSubmit={(event) => { event.preventDefault(); save(); }} noValidate>
        <div className="section-title"><h3>اطلاعات شخصی</h3></div>
        <div className="form-grid">
          {field("firstName", "first_name", "نام", { autoComplete: "given-name", dir: "rtl" })}
          {field("lastName", "last_name", "نام خانوادگی", { autoComplete: "family-name", dir: "rtl" })}
          {field("birthDate", "birth_date", "تاریخ تولد (شمسی)", { inputMode: "numeric", dir: "ltr", placeholder: "1370/01/01", maxLength: 10 })}
          {field("emergencyPhone", "emergency_phone", "تلفن اضطراری", { type: "tel", inputMode: "tel", dir: "ltr", placeholder: "09xxxxxxxxx", autoComplete: "tel" })}
        </div>
        <label className="form-field">
          <span>شماره موبایل</span>
          <input value={user?.mobile || ""} dir="ltr" readOnly aria-readonly="true" />
        </label>

        <div className="section-title form-subtitle"><h3>اطلاعات خودرو</h3><span className="muted small-text">اختیاری</span></div>
        <div className="form-grid">
          {field("model", "model", "مدل خودرو", { dir: "rtl", placeholder: "مثلاً دنا پلاس" })}
          {field("productionYear", "production_year", "سال تولید", { inputMode: "numeric", dir: "ltr", placeholder: "1402", maxLength: 4 })}
          {field("color", "color", "رنگ", { dir: "rtl", placeholder: "مثلاً سفید" })}
          {field("plate", "license_plate", "پلاک", { dir: "rtl", placeholder: "مثلاً ۱۲ب۳۴۵ ایران ۶۷", maxLength: 20 })}
        </div>
        {saveState && <div className={saveState.tone === "success" ? "inline-success" : "form-error"} role="status">{saveState.text}</div>}
        <button type="submit" className="primary-btn full-btn" disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره اطلاعات"}</button>
      </form>

      <section className="panel backend-test-card">
        <div className="mini-heading"><DatabaseZap /><strong>دسترسی به سرور</strong></div>
        <p className="muted">بررسی می‌کند سرور گاما از این مرورگر در دسترس است.</p>
        <button type="button" className="secondary-btn" disabled={checking} onClick={test}>{checking ? "در حال بررسی..." : "تست اتصال Backend"}</button>
        {backend && <div className={backend.reachable ? "inline-success" : "form-error"}>{backend.reachable ? "سرور در دسترس است." : "سرور از این مرورگر در دسترس نیست."}</div>}
      </section>

      <button type="button" className="danger-btn" onClick={onLogout}><LogOut size={18} /> خروج از حساب</button>
    </section>
  );
}

function SettingRow({ icon, title, subtitle, onClick }) {
  return (
    <button className="setting-row" type="button" onClick={onClick}>
      <div className="setting-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span className="muted">{subtitle}</span>
      </div>
      <span className="card-chevron">‹</span>
    </button>
  );
}
