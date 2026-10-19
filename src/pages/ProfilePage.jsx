import { ChevronDown, LogOut, Pencil, UserRound, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { isoToJalali, jalaliToIso } from "../utils/jalali.mjs";

const VIEWS = { CLOSED: "closed", DETAILS: "details", EDIT: "edit" };

function formFromUser(user) {
  return { first_name: user?.firstName || "", last_name: user?.lastName || "", birth_date: isoToJalali(user?.birthDate) };
}

// Customer-facing wording only: no "Backend", no raw HTTP status.
export function connectionMessage(result) {
  if (!result) return "";
  if (result.mock) return "حالت آزمایشی فعال است.";
  if (result.healthy) return "اتصال برقرار است.";
  if (result.reason === "network" || result.reason === "timeout") return "اتصال برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.";
  return "سرویس گاما در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کنید.";
}

export default function ProfilePage({ user, onTestBackend, onBack, onLogout, onUpdate, defaultView = VIEWS.CLOSED }) {
  const [view, setView] = useState(defaultView);
  const [form, setForm] = useState(() => formFromUser(user));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState(null);
  const toggleRef = useRef(null);
  const editRef = useRef(null);
  const firstFieldRef = useRef(null);
  const focusAfter = useRef(null);

  const editing = view === VIEWS.EDIT;
  const expanded = view !== VIEWS.CLOSED;
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "کاربر گاما";

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === "field") firstFieldRef.current?.focus();
    else if (target === "edit") editRef.current?.focus();
    else if (target === "toggle") toggleRef.current?.focus();
  }, [view]);

  const toggle = () => { if (!editing) setView(expanded ? VIEWS.CLOSED : VIEWS.DETAILS); };
  const startEdit = () => {
    setForm(formFromUser(user));
    setSaveError("");
    focusAfter.current = "field";
    setView(VIEWS.EDIT);
  };
  const cancel = () => {
    if (saving) return;
    setForm(formFromUser(user));
    setSaveError("");
    focusAfter.current = "edit";
    setView(VIEWS.DETAILS);
  };

  const save = async (event) => {
    event.preventDefault();
    const birthDate = jalaliToIso(form.birth_date);
    if (!form.first_name.trim() || !form.last_name.trim() || !birthDate) {
      setSaveError("نام، نام خانوادگی و تاریخ تولد شمسی معتبر را وارد کنید.");
      return;
    }
    setSaving(true); setSaveError("");
    try {
      await onUpdate({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), birth_date: birthDate });
      focusAfter.current = "edit";
      setView(VIEWS.DETAILS);
    } catch (error) {
      // Keep the form open with the user's input so they can retry.
      setSaveError(error?.message || "ذخیرهٔ پروفایل ناموفق بود.");
    } finally { setSaving(false); }
  };

  const test = async () => {
    setChecking(true); setConnection(null);
    try { setConnection(await onTestBackend()); }
    catch { setConnection({ healthy: false, reason: "network" }); }
    finally { setChecking(false); }
  };

  const field = (key) => ({ value: form[key], disabled: saving, onChange: (event) => setForm({ ...form, [key]: event.target.value }) });

  return <section className="page-section profile-page">
    <PageHeader eyebrow="ACCOUNT" title="پروفایل" subtitle="اطلاعات حساب شما" onBack={onBack} />

    <section className={`panel profile-account${expanded ? " is-open" : ""}`}>
      <div className="profile-bar">
        <button ref={toggleRef} type="button" className="profile-bar-toggle" aria-expanded={expanded} aria-controls="profile-panel" disabled={editing} onClick={toggle}>
          <span className="profile-avatar" aria-hidden="true"><UserRound size={24} /></span>
          <span className="profile-bar-text"><strong>{fullName}</strong><small dir="ltr">{user?.mobile || "—"}</small></span>
          <ChevronDown className="profile-bar-chevron" size={20} aria-hidden="true" />
          <span className="sr-only">{expanded ? "بستن اطلاعات شخصی" : "نمایش اطلاعات شخصی"}</span>
        </button>
        {!editing && <button ref={editRef} type="button" className="secondary-btn profile-edit-btn" onClick={startEdit}><Pencil size={16} aria-hidden="true" /> ویرایش</button>}
      </div>

      {view === VIEWS.DETAILS && <dl id="profile-panel" className="profile-details">
        <div><dt>نام</dt><dd>{user?.firstName || "—"}</dd></div>
        <div><dt>نام خانوادگی</dt><dd>{user?.lastName || "—"}</dd></div>
        <div><dt>تاریخ تولد</dt><dd dir="ltr">{isoToJalali(user?.birthDate) || "—"}</dd></div>
        <div><dt>شماره موبایل</dt><dd dir="ltr">{user?.mobile || "—"}</dd></div>
      </dl>}

      {editing && <form id="profile-panel" className="profile-form" onSubmit={save} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }} noValidate>
        <div className="section-title"><h3>ویرایش اطلاعات شخصی</h3></div>
        <div className="form-grid">
          <label htmlFor="first-name"><span>نام</span><input ref={firstFieldRef} id="first-name" autoComplete="given-name" {...field("first_name")} /></label>
          <label htmlFor="last-name"><span>نام خانوادگی</span><input id="last-name" autoComplete="family-name" {...field("last_name")} /></label>
          <label htmlFor="birth-date"><span>تاریخ تولد (شمسی)</span><input id="birth-date" placeholder="yyyy/mm/dd" inputMode="numeric" dir="ltr" maxLength={10} {...field("birth_date")} /></label>
          <label htmlFor="mobile"><span>شماره موبایل (غیرقابل ویرایش)</span><input id="mobile" value={user?.mobile || ""} dir="ltr" readOnly aria-readonly="true" /></label>
        </div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="profile-form-actions">
          <button type="submit" className="primary-btn" disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره"}</button>
          <button type="button" className="ghost-btn" disabled={saving} onClick={cancel}>انصراف</button>
        </div>
      </form>}
    </section>

    <section className="panel backend-test-card">
      <div className="mini-heading"><Wifi size={20} aria-hidden="true" /><strong>بررسی اتصال</strong></div>
      <p className="muted compact">ارتباط برنامه با سرویس گاما را بررسی کنید.</p>
      <button type="button" className="secondary-btn" disabled={checking} onClick={test}>{checking ? "در حال بررسی..." : "بررسی اتصال"}</button>
      <div aria-live="polite">
        {connection && <p className={connection.healthy ? "inline-success" : "form-error"} role="status">{connectionMessage(connection)}</p>}
      </div>
    </section>

    <button type="button" className="danger-btn" onClick={onLogout}><LogOut size={18} /> خروج از حساب</button>
  </section>;
}
