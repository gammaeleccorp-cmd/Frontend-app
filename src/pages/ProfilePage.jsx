import { DatabaseZap, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { isoToJalali, jalaliToIso } from "../utils/jalali.mjs";

export default function ProfilePage({ user, onTestBackend, onBack, onLogout, onUpdate }) {
  const [form, setForm] = useState(() => ({ first_name: user?.firstName || "", last_name: user?.lastName || "", birth_date: isoToJalali(user?.birthDate) }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [checking, setChecking] = useState(false);
  const [backend, setBackend] = useState(null);
  useEffect(() => { setForm({ first_name: user?.firstName || "", last_name: user?.lastName || "", birth_date: isoToJalali(user?.birthDate) }); }, [user?.firstName, user?.lastName, user?.birthDate]);

  const save = async (event) => {
    event.preventDefault();
    const birthDate = jalaliToIso(form.birth_date);
    if (!form.first_name.trim() || !form.last_name.trim() || !birthDate) {
      setSaveError("نام، نام خانوادگی و تاریخ تولد شمسی معتبر را وارد کنید.");
      return;
    }
    setSaving(true); setSaveError("");
    try { await onUpdate({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), birth_date: birthDate }); }
    catch (error) { setSaveError(error?.message || "ذخیرهٔ پروفایل ناموفق بود."); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setChecking(true); setBackend(null);
    try { setBackend(await onTestBackend()); }
    catch { setBackend({ reachable: false, status: 0 }); }
    finally { setChecking(false); }
  };

  return <section className="page-section profile-page">
    <PageHeader eyebrow="ACCOUNT" title="پروفایل" subtitle="اطلاعات حساب شما" onBack={onBack} />
    <section className="profile-intro">
      <div className="profile-avatar"><UserRound size={28} /></div>
      <div><h3>{`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "کاربر گاما"}</h3><p className="muted compact" dir="ltr">{user?.mobile || "—"}</p></div>
    </section>

    <form className="panel profile-form" onSubmit={save}>
      <div className="section-title"><h3>اطلاعات شخصی</h3></div>
      <div className="form-grid">
        <label htmlFor="first-name"><span>نام</span><input id="first-name" autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} disabled={saving} /></label>
        <label htmlFor="last-name"><span>نام خانوادگی</span><input id="last-name" autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} disabled={saving} /></label>
        <label htmlFor="birth-date"><span>تاریخ تولد (شمسی)</span><input id="birth-date" value={form.birth_date} placeholder="yyyy/mm/dd" inputMode="numeric" dir="ltr" maxLength={10} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} disabled={saving} /></label>
        <label htmlFor="mobile"><span>شماره موبایل</span><input id="mobile" value={user?.mobile || ""} dir="ltr" readOnly aria-readonly="true" /></label>
        <label htmlFor="national-id"><span>کد ملی</span><input id="national-id" value={user?.nationalId || "ثبت نشده"} dir="ltr" readOnly aria-readonly="true" /></label>
      </div>
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <button type="submit" className="primary-btn profile-save" disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره اطلاعات"}</button>
    </form>

    <section className="panel backend-test-card">
      <div className="mini-heading"><DatabaseZap size={20} /><strong>بررسی ارتباط سرور</strong></div>
      <button type="button" className="secondary-btn" disabled={checking} onClick={test}>{checking ? "در حال بررسی..." : "تست اتصال Backend"}</button>
      {backend && <p className={backend.reachable ? "inline-success" : "form-error"} role="status">
        {backend.mock ? "حالت آزمایشی فعال است." : backend.reachable ? `سرور در دسترس است (HTTP ${backend.status}).` : "ارتباط با سرور برقرار نشد."}
      </p>}
    </section>

    <button type="button" className="danger-btn" onClick={onLogout}><LogOut size={18} /> خروج از حساب</button>
  </section>;
}
